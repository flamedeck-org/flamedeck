import * as tracesApi from "./traces";
import * as commentApi from "./comments";
import * as folderApi from "./folders";
import * as userApi from "./users";
import * as directoryListingApi from "./directoryListing";
import * as tracePermissionsApi from "./tracePermissions";
import * as storageApi from "./storage";

export * from "./types";

export const traceApi = {
    ...tracesApi,
    ...commentApi,
    ...folderApi,
    ...userApi,
    ...directoryListingApi,
    ...tracePermissionsApi,
    ...storageApi,
};
