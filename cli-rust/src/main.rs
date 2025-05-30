use clap::{Parser, Subcommand};
use reqwest::{header, Body, Client, Error as ReqwestError};
use serde::Deserialize;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::env;
use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};
use anyhow::{Context, Result, anyhow};
use futures_util::stream::TryStreamExt; // For map_err

// Default Supabase function URL
const DEFAULT_SUPABASE_FUNCTIONS_URL: &str = "https://jczffinsulwdzhgzggcj.supabase.co/functions/v1";
// Default Flamedeck application URL
const DEFAULT_FLAMEDECK_URL: &str = "https://www.flamedeck.com";

/// Main CLI structure - expects a subcommand
#[derive(Parser, Debug)]
#[command(author, version, about = "Flamedeck CLI", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

/// Enum defining the available subcommands
#[derive(Subcommand, Debug)]
enum Commands {
    /// Upload a trace file to Flamedeck
    Upload(UploadArgs),
    // Add other subcommands here in the future if needed
}

/// Arguments specific to the 'upload' subcommand
#[derive(Parser, Debug)]
struct UploadArgs {
    /// Path to the trace file (reads from stdin if omitted)
    file_path: Option<PathBuf>,

    /// Flamedeck API Key (can also use FLAMEDECK_API_KEY env var)
    #[arg(short = 'k', long)]
    api_key: Option<String>,

    /// Required filename when reading from stdin
    #[arg(short = 'n', long)]
    file_name: Option<String>,

    /// Scenario description (REQUIRED)
    #[arg(short = 's', long)]
    scenario: String,

    /// Git commit SHA
    #[arg(short = 'c', long)]
    commit: Option<String>,

    /// Git branch name
    #[arg(short = 'b', long)]
    branch: Option<String>,

    /// Notes for the trace
    #[arg(long)]
    notes: Option<String>,

    /// UUID of the target folder
    #[arg(long)]
    folder_id: Option<String>,

    /// Optional JSON metadata as a string
    #[arg(long)]
    metadata: Option<String>,

    /// Make the uploaded trace publicly viewable
    #[arg(long)]
    public: bool,

    /// Override Supabase functions base URL
    #[arg(long)]
    supabase_url: Option<String>,
}

// Structure to deserialize the successful JSON response (only need id)
#[derive(Deserialize, Debug)]
struct UploadSuccessResponse {
    id: String,
}

// Structure to deserialize potential error JSON responses
#[derive(Deserialize, Debug)]
struct UploadErrorResponse {
    error: String,
    issues: Option<serde_json::Value>, // Can be various structures
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Match on the command provided
    match cli.command {
        Commands::Upload(args) => {
            // --- Get API Key ---
            let api_key = args.api_key
                .or_else(|| env::var("FLAMEDECK_API_KEY").ok())
                .context("API Key is required. Provide via --api-key flag or FLAMEDECK_API_KEY environment variable.")?;

            // --- Determine Input and Filename ---
            let file_name: String;
            let body: Body;

            if let Some(ref file_path_arg) = args.file_path {
                let path = Path::new(file_path_arg);
                if !path.exists() {
                    return Err(anyhow!("File not found at {}", path.display()));
                }
                file_name = args.file_name
                    .clone()
                    .or_else(|| path.file_name().map(|os_str| os_str.to_string_lossy().into_owned()))
                    .context("Could not determine filename from path.")?;
                
                println!("Reading trace from: {}", path.display());
                let file = File::open(path).await.context("Failed to open file")?;
                let stream = FramedRead::new(file, BytesCodec::new())
                    .map_err(|e| anyhow!("IO error reading file: {}", e));
                body = Body::wrap_stream(stream);

            } else {
                file_name = args.file_name.context("--file-name is required when reading from stdin.")?;
                println!("Reading trace from stdin...");
                let mut buffer = Vec::new();
                io::stdin().read_to_end(&mut buffer).context("Failed to read from stdin")?;
                if buffer.is_empty() {
                    return Err(anyhow!("Input trace data from stdin is empty."));
                }
                body = Body::from(buffer);
            }

            // --- Build Query Parameters --- 
            let mut params = Vec::new();
            params.push(("fileName", file_name.clone()));
            params.push(("scenario", args.scenario.clone()));
            if let Some(ref commit) = args.commit { params.push(("commitSha", commit.clone())); }
            if let Some(ref branch) = args.branch { params.push(("branch", branch.clone())); }
            if let Some(ref notes) = args.notes { params.push(("notes", notes.clone())); }
            if let Some(ref folder_id) = args.folder_id { params.push(("folderId", folder_id.clone())); }
            if let Some(ref metadata) = args.metadata { 
                if serde_json::from_str::<serde_json::Value>(metadata).is_err() {
                    return Err(anyhow!("--metadata must be a valid JSON string"));
                }
                params.push(("metadata", metadata.clone())); 
            }
            // Add public flag if set
            if args.public {
                params.push(("public", "true".to_string()));
            }

            // --- Build Request URL ---
            let api_base_url = args.supabase_url.as_deref().unwrap_or(DEFAULT_SUPABASE_FUNCTIONS_URL);
            let url = reqwest::Url::parse_with_params(&format!("{}/upload-trace", api_base_url), &params)
                .context("Failed to construct request URL")?;

            // --- Build HTTP Client and Headers ---
            let mut headers = header::HeaderMap::new();
            headers.insert(header::AUTHORIZATION, header::HeaderValue::from_str(&format!("Bearer {}", api_key))?);
            headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("application/octet-stream"));

            let client = Client::builder()
                .default_headers(headers)
                .build()
                .context("Failed to build HTTP client")?;

            // --- Make Request ---
            println!("Uploading trace '{}' (Scenario: {})...", file_name, args.scenario);
            let response = client.post(url)
                .body(body)
                .send()
                .await
                .context("HTTP request failed")?;

            let status = response.status();
            let response_bytes = response.bytes().await.context("Failed to read response body")?;

            // --- Handle Response ---
            if status.is_success() {
                let success_data: UploadSuccessResponse = serde_json::from_slice(&response_bytes)
                    .with_context(|| format!("Failed to parse successful API response JSON (status: {}). Body: {}", status, String::from_utf8_lossy(&response_bytes)))?;
                
                let view_url = format!("{}/traces/{}/view", DEFAULT_FLAMEDECK_URL, success_data.id);
                println!("Upload successful!");
                println!("View trace at: {}", view_url);
                Ok(())
            } else {
                match serde_json::from_slice::<UploadErrorResponse>(&response_bytes) {
                    Ok(error_data) => {
                        eprintln!("\n--- Upload Failed ---");
                        eprintln!("Error ({}): {}", status, error_data.error);
                        if let Some(issues) = error_data.issues {
                            eprintln!("Details: {}", serde_json::to_string_pretty(&issues).unwrap_or_else(|_| format!("{:?}", issues)));
                        }
                        eprintln!("---------------------");
                        Err(anyhow!("API Error ({})", status))
                    }
                    Err(_) => {
                        eprintln!("\n--- Upload Failed ---");
                        eprintln!("API Error ({}) with unparseable response body:", status);
                        eprintln!("{}", String::from_utf8_lossy(&response_bytes));
                        eprintln!("---------------------");
                        Err(anyhow!("API Error ({}) with unparseable body", status))
                    }
                }
            }
        }
        // Add handlers for other commands here if added later
    }
}
