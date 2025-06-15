import type { Page } from '@playwright/test';
import type { ResourceMetrics } from '../types/playwright-metrics';

/**
 * Resource Timing collector based on the Resource Timing API
 * https://www.checklyhq.com/learn/playwright/performance/
 */
export class ResourceTimingCollector {
  /**
   * Collect aggregated resource timing metrics from a page
   */
  static async collectResourceTiming(page: Page): Promise<ResourceMetrics> {
    const resourceData = await page.evaluate(() => {
      const resourceTimingJson = JSON.stringify(performance.getEntriesByType('resource'));
      return JSON.parse(resourceTimingJson);
    });

    if (!resourceData || resourceData.length === 0) {
      return {
        resourceCount: 0,
        totalResourceSize: 0,
        averageResourceLoadTime: 0,
        largestResourceSize: 0,
        slowestResourceLoadTime: 0,
      };
    }

    // Calculate aggregated metrics
    const loadTimes = resourceData.map((resource: any) => resource.duration || 0);
    const sizes = resourceData
      .map((resource: any) => resource.transferSize || resource.encodedBodySize || 0)
      .filter((size: number) => size > 0);

    const totalLoadTime = loadTimes.reduce((sum: number, time: number) => sum + time, 0);
    const totalSize = sizes.reduce((sum: number, size: number) => sum + size, 0);

    return {
      resourceCount: resourceData.length,
      totalResourceSize: totalSize,
      averageResourceLoadTime: resourceData.length > 0 ? totalLoadTime / resourceData.length : 0,
      largestResourceSize: sizes.length > 0 ? Math.max(...sizes) : 0,
      slowestResourceLoadTime: loadTimes.length > 0 ? Math.max(...loadTimes) : 0,
    };
  }

  /**
   * Get detailed resource timing information
   */
  static async getDetailedResourceTiming(page: Page): Promise<
    Array<{
      name: string;
      initiatorType: string;
      duration: number;
      transferSize: number;
      encodedBodySize: number;
      decodedBodySize: number;
      startTime: number;
      responseEnd: number;
      type: string;
    }>
  > {
    return page.evaluate(() => {
      const resourceEntries = performance.getEntriesByType('resource');

      const getResourceType = (url: string, initiatorType: string): string => {
        if (!url) return 'other';

        const urlLower = url.toLowerCase();

        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/)) return 'image';
        if (urlLower.match(/\.(js|mjs)(\?|$)/)) return 'script';
        if (urlLower.match(/\.(css)(\?|$)/)) return 'stylesheet';
        if (urlLower.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/)) return 'font';
        if (urlLower.match(/\.(html|htm)(\?|$)/)) return 'document';

        switch (initiatorType) {
          case 'img':
            return 'image';
          case 'script':
            return 'script';
          case 'css':
          case 'link':
            return 'stylesheet';
          case 'xmlhttprequest':
          case 'fetch':
            return 'xhr';
          default:
            return 'other';
        }
      };

      return resourceEntries.map((resource: any) => ({
        name: resource.name || '',
        initiatorType: resource.initiatorType || 'other',
        duration: resource.duration || 0,
        transferSize: resource.transferSize || 0,
        encodedBodySize: resource.encodedBodySize || 0,
        decodedBodySize: resource.decodedBodySize || 0,
        startTime: resource.startTime || 0,
        responseEnd: resource.responseEnd || 0,
        type: getResourceType(resource.name, resource.initiatorType),
      }));
    });
  }

  /**
   * Get resource timing grouped by type
   */
  static async getResourceTimingByType(page: Page): Promise<{
    images: Array<any>;
    scripts: Array<any>;
    stylesheets: Array<any>;
    fonts: Array<any>;
    documents: Array<any>;
    other: Array<any>;
    summary: {
      images: { count: number; totalSize: number; averageLoadTime: number };
      scripts: { count: number; totalSize: number; averageLoadTime: number };
      stylesheets: { count: number; totalSize: number; averageLoadTime: number };
      fonts: { count: number; totalSize: number; averageLoadTime: number };
      documents: { count: number; totalSize: number; averageLoadTime: number };
      other: { count: number; totalSize: number; averageLoadTime: number };
    };
  }> {
    return page.evaluate(() => {
      const resourceEntries = performance.getEntriesByType('resource');

      const getResourceType = (url: string, initiatorType: string): string => {
        if (!url) return 'other';
        const urlLower = url.toLowerCase();
        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/)) return 'image';
        if (urlLower.match(/\.(js|mjs)(\?|$)/)) return 'script';
        if (urlLower.match(/\.(css)(\?|$)/)) return 'stylesheet';
        if (urlLower.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/)) return 'font';
        if (urlLower.match(/\.(html|htm)(\?|$)/)) return 'document';

        switch (initiatorType) {
          case 'img':
            return 'image';
          case 'script':
            return 'script';
          case 'css':
          case 'link':
            return 'stylesheet';
          case 'xmlhttprequest':
          case 'fetch':
            return 'xhr';
          default:
            return 'other';
        }
      };

      const grouped = {
        images: [] as any[],
        scripts: [] as any[],
        stylesheets: [] as any[],
        fonts: [] as any[],
        documents: [] as any[],
        other: [] as any[],
      };

      resourceEntries.forEach((resource: any) => {
        const resourceInfo = {
          name: resource.name,
          duration: resource.duration || 0,
          transferSize: resource.transferSize || 0,
          initiatorType: resource.initiatorType,
        };

        const type = getResourceType(resource.name, resource.initiatorType);

        switch (type) {
          case 'image':
            grouped.images.push(resourceInfo);
            break;
          case 'script':
            grouped.scripts.push(resourceInfo);
            break;
          case 'stylesheet':
            grouped.stylesheets.push(resourceInfo);
            break;
          case 'font':
            grouped.fonts.push(resourceInfo);
            break;
          case 'document':
            grouped.documents.push(resourceInfo);
            break;
          default:
            grouped.other.push(resourceInfo);
        }
      });

      // Calculate summaries
      const calculateSummary = (resources: any[]) => ({
        count: resources.length,
        totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
        averageLoadTime:
          resources.length > 0
            ? resources.reduce((sum, r) => sum + (r.duration || 0), 0) / resources.length
            : 0,
      });

      return {
        ...grouped,
        summary: {
          images: calculateSummary(grouped.images),
          scripts: calculateSummary(grouped.scripts),
          stylesheets: calculateSummary(grouped.stylesheets),
          fonts: calculateSummary(grouped.fonts),
          documents: calculateSummary(grouped.documents),
          other: calculateSummary(grouped.other),
        },
      };
    });
  }

  /**
   * Get slow resources (above threshold)
   */
  static async getSlowResources(
    page: Page,
    thresholdMs: number = 1000
  ): Promise<
    Array<{
      name: string;
      duration: number;
      transferSize: number;
      type: string;
      initiatorType: string;
    }>
  > {
    return page.evaluate((threshold) => {
      const resourceEntries = performance.getEntriesByType('resource');

      const getResourceType = (url: string, initiatorType: string): string => {
        if (!url) return 'other';
        const urlLower = url.toLowerCase();
        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/)) return 'image';
        if (urlLower.match(/\.(js|mjs)(\?|$)/)) return 'script';
        if (urlLower.match(/\.(css)(\?|$)/)) return 'stylesheet';
        if (urlLower.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/)) return 'font';
        if (urlLower.match(/\.(html|htm)(\?|$)/)) return 'document';

        switch (initiatorType) {
          case 'img':
            return 'image';
          case 'script':
            return 'script';
          case 'css':
          case 'link':
            return 'stylesheet';
          case 'xmlhttprequest':
          case 'fetch':
            return 'xhr';
          default:
            return 'other';
        }
      };

      return resourceEntries
        .filter((resource: any) => (resource.duration || 0) > threshold)
        .map((resource: any) => ({
          name: resource.name || '',
          duration: resource.duration || 0,
          transferSize: resource.transferSize || 0,
          type: getResourceType(resource.name, resource.initiatorType),
          initiatorType: resource.initiatorType || 'other',
        }))
        .sort((a, b) => b.duration - a.duration);
    }, thresholdMs);
  }

  /**
   * Get large resources (above size threshold)
   */
  static async getLargeResources(
    page: Page,
    thresholdBytes: number = 500000
  ): Promise<
    Array<{
      name: string;
      transferSize: number;
      encodedBodySize: number;
      type: string;
      compression: number;
    }>
  > {
    return page.evaluate((threshold) => {
      const resourceEntries = performance.getEntriesByType('resource');

      const getResourceType = (url: string, initiatorType: string): string => {
        if (!url) return 'other';
        const urlLower = url.toLowerCase();
        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/)) return 'image';
        if (urlLower.match(/\.(js|mjs)(\?|$)/)) return 'script';
        if (urlLower.match(/\.(css)(\?|$)/)) return 'stylesheet';
        if (urlLower.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/)) return 'font';
        if (urlLower.match(/\.(html|htm)(\?|$)/)) return 'document';

        switch (initiatorType) {
          case 'img':
            return 'image';
          case 'script':
            return 'script';
          case 'css':
          case 'link':
            return 'stylesheet';
          case 'xmlhttprequest':
          case 'fetch':
            return 'xhr';
          default:
            return 'other';
        }
      };

      return resourceEntries
        .filter((resource: any) => (resource.transferSize || 0) > threshold)
        .map((resource: any) => {
          const transferSize = resource.transferSize || 0;
          const encodedSize = resource.encodedBodySize || 0;
          const compression =
            encodedSize > 0 ? ((encodedSize - transferSize) / encodedSize) * 100 : 0;

          return {
            name: resource.name || '',
            transferSize,
            encodedBodySize: encodedSize,
            type: getResourceType(resource.name, resource.initiatorType),
            compression: Math.max(0, compression),
          };
        })
        .sort((a, b) => b.transferSize - a.transferSize);
    }, thresholdBytes);
  }

  /**
   * Determine resource type from URL and initiator type
   */
  private static getResourceType(url: string, initiatorType: string): string {
    if (!url) return 'other';

    const urlLower = url.toLowerCase();

    // Check file extension
    if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/)) {
      return 'image';
    }
    if (urlLower.match(/\.(js|mjs)(\?|$)/)) {
      return 'script';
    }
    if (urlLower.match(/\.(css)(\?|$)/)) {
      return 'stylesheet';
    }
    if (urlLower.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/)) {
      return 'font';
    }
    if (urlLower.match(/\.(html|htm)(\?|$)/)) {
      return 'document';
    }

    // Check initiator type
    switch (initiatorType) {
      case 'img':
        return 'image';
      case 'script':
        return 'script';
      case 'css':
      case 'link':
        return 'stylesheet';
      case 'xmlhttprequest':
      case 'fetch':
        return 'xhr';
      default:
        return 'other';
    }
  }

  /**
   * Wait for resources to finish loading
   */
  static async waitForResources(page: Page, timeout: number = 10000): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Check if resource timing is supported
   */
  static async isResourceTimingSupported(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        'performance' in window &&
        'getEntriesByType' in performance &&
        performance.getEntriesByType('resource').length >= 0
      );
    });
  }

  /**
   * Calculate resource performance score
   */
  static calculateResourceScore(metrics: ResourceMetrics): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check resource count
    if (metrics.resourceCount > 100) {
      issues.push(`High resource count: ${metrics.resourceCount} resources`);
      score -= 20;
    } else if (metrics.resourceCount > 50) {
      issues.push(`Moderate resource count: ${metrics.resourceCount} resources`);
      score -= 10;
    }

    // Check total resource size (in MB)
    const totalSizeMB = metrics.totalResourceSize / (1024 * 1024);
    if (totalSizeMB > 5) {
      issues.push(`Large total resource size: ${totalSizeMB.toFixed(2)} MB`);
      score -= 25;
    } else if (totalSizeMB > 2) {
      issues.push(`Moderate total resource size: ${totalSizeMB.toFixed(2)} MB`);
      score -= 15;
    }

    // Check average load time
    if (metrics.averageResourceLoadTime > 500) {
      issues.push(
        `Slow average resource load time: ${metrics.averageResourceLoadTime.toFixed(0)}ms`
      );
      score -= 20;
    } else if (metrics.averageResourceLoadTime > 200) {
      issues.push(
        `Moderate average resource load time: ${metrics.averageResourceLoadTime.toFixed(0)}ms`
      );
      score -= 10;
    }

    // Check slowest resource
    if (metrics.slowestResourceLoadTime > 2000) {
      issues.push(`Very slow resource detected: ${metrics.slowestResourceLoadTime.toFixed(0)}ms`);
      score -= 25;
    } else if (metrics.slowestResourceLoadTime > 1000) {
      issues.push(`Slow resource detected: ${metrics.slowestResourceLoadTime.toFixed(0)}ms`);
      score -= 15;
    }

    return {
      score: Math.max(0, score),
      issues,
    };
  }
}
