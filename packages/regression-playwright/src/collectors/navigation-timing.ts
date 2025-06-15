import type { Page } from '@playwright/test';
import type { NavigationMetrics } from '../types/playwright-metrics';

/**
 * Navigation Timing collector based on the Navigation Timing API
 * https://www.checklyhq.com/learn/playwright/performance/
 */
export class NavigationTimingCollector {
  /**
   * Collect all navigation timing metrics from a page
   */
  static async collectNavigationTiming(page: Page): Promise<NavigationMetrics> {
    const navigationData = await page.evaluate(() => {
      const navigationTimingJson = JSON.stringify(performance.getEntriesByType('navigation'));
      return JSON.parse(navigationTimingJson);
    });

    if (!navigationData || navigationData.length === 0) {
      throw new Error('Navigation timing data not available');
    }

    const nav = navigationData[0];

    return {
      ttfb: this.calculateTTFB(nav),
      dnsLookup: this.calculateDNSLookup(nav),
      tcpConnection: this.calculateTCPConnection(nav),
      requestResponse: this.calculateRequestResponse(nav),
      domInteractive: nav.domInteractive || 0,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.navigationStart || 0,
      loadEvent: nav.loadEventEnd - nav.navigationStart || 0,
      totalLoadTime: nav.loadEventEnd - nav.navigationStart || 0,
    };
  }

  /**
   * Calculate Time to First Byte (TTFB)
   */
  private static calculateTTFB(nav: any): number {
    if (!nav.responseStart || !nav.requestStart) {
      return 0;
    }
    return nav.responseStart - nav.requestStart;
  }

  /**
   * Calculate DNS lookup time
   */
  private static calculateDNSLookup(nav: any): number {
    if (!nav.domainLookupEnd || !nav.domainLookupStart) {
      return 0;
    }
    return nav.domainLookupEnd - nav.domainLookupStart;
  }

  /**
   * Calculate TCP connection time (including SSL if applicable)
   */
  private static calculateTCPConnection(nav: any): number {
    if (!nav.connectEnd || !nav.connectStart) {
      return 0;
    }
    return nav.connectEnd - nav.connectStart;
  }

  /**
   * Calculate request/response time
   */
  private static calculateRequestResponse(nav: any): number {
    if (!nav.responseEnd || !nav.requestStart) {
      return 0;
    }
    return nav.responseEnd - nav.requestStart;
  }

  /**
   * Get detailed navigation timing breakdown
   */
  static async getDetailedNavigationTiming(page: Page): Promise<{
    phases: Record<string, number>;
    timestamps: Record<string, number>;
    protocol: string;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
  }> {
    return page.evaluate(() => {
      const navEntries = performance.getEntriesByType('navigation');
      if (!navEntries || navEntries.length === 0) {
        throw new Error('Navigation timing not available');
      }

      const nav = navEntries[0] as any;

      // Calculate all timing phases
      const phases = {
        redirect: nav.redirectEnd - nav.redirectStart,
        appCache: nav.domainLookupStart - nav.fetchStart,
        dns: nav.domainLookupEnd - nav.domainLookupStart,
        tcp: nav.connectEnd - nav.connectStart,
        ssl: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
        request: nav.responseStart - nav.requestStart,
        response: nav.responseEnd - nav.responseStart,
        processing: nav.domComplete - nav.domLoading,
        onLoad: nav.loadEventEnd - nav.loadEventStart,
      };

      // Key timestamps relative to navigation start
      const timestamps = {
        navigationStart: 0,
        redirectStart: nav.redirectStart - nav.navigationStart,
        redirectEnd: nav.redirectEnd - nav.navigationStart,
        fetchStart: nav.fetchStart - nav.navigationStart,
        domainLookupStart: nav.domainLookupStart - nav.navigationStart,
        domainLookupEnd: nav.domainLookupEnd - nav.navigationStart,
        connectStart: nav.connectStart - nav.navigationStart,
        connectEnd: nav.connectEnd - nav.navigationStart,
        secureConnectionStart:
          nav.secureConnectionStart > 0 ? nav.secureConnectionStart - nav.navigationStart : 0,
        requestStart: nav.requestStart - nav.navigationStart,
        responseStart: nav.responseStart - nav.navigationStart,
        responseEnd: nav.responseEnd - nav.navigationStart,
        domLoading: nav.domLoading - nav.navigationStart,
        domInteractive: nav.domInteractive - nav.navigationStart,
        domContentLoadedEventStart: nav.domContentLoadedEventStart - nav.navigationStart,
        domContentLoadedEventEnd: nav.domContentLoadedEventEnd - nav.navigationStart,
        domComplete: nav.domComplete - nav.navigationStart,
        loadEventStart: nav.loadEventStart - nav.navigationStart,
        loadEventEnd: nav.loadEventEnd - nav.navigationStart,
      };

      return {
        phases,
        timestamps,
        protocol: nav.nextHopProtocol || 'unknown',
        transferSize: nav.transferSize || 0,
        encodedBodySize: nav.encodedBodySize || 0,
        decodedBodySize: nav.decodedBodySize || 0,
      };
    });
  }

  /**
   * Wait for navigation timing to be available
   */
  static async waitForNavigationTiming(page: Page, timeout: number = 5000): Promise<void> {
    await page.waitForFunction(
      () => {
        const navEntries = performance.getEntriesByType('navigation');
        return navEntries && navEntries.length > 0 && (navEntries[0] as any).loadEventEnd > 0;
      },
      { timeout }
    );
  }

  /**
   * Check if navigation timing is supported
   */
  static async isNavigationTimingSupported(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        'performance' in window &&
        'getEntriesByType' in performance &&
        performance.getEntriesByType('navigation').length > 0
      );
    });
  }

  /**
   * Get server timing information if available
   */
  static async getServerTiming(page: Page): Promise<
    Array<{
      name: string;
      duration: number;
      description: string;
    }>
  > {
    return page.evaluate(() => {
      const navEntries = performance.getEntriesByType('navigation');
      if (!navEntries || navEntries.length === 0) {
        return [];
      }

      const nav = navEntries[0] as any;
      if (!nav.serverTiming || nav.serverTiming.length === 0) {
        return [];
      }

      return nav.serverTiming.map((timing: any) => ({
        name: timing.name || '',
        duration: timing.duration || 0,
        description: timing.description || '',
      }));
    });
  }

  /**
   * Calculate performance score based on navigation timing
   */
  static calculatePerformanceScore(metrics: NavigationMetrics): {
    score: number;
    grades: Record<string, 'good' | 'needs-improvement' | 'poor'>;
  } {
    const grades: Record<string, 'good' | 'needs-improvement' | 'poor'> = {};
    let totalScore = 0;
    let metricCount = 0;

    // TTFB grading (Core Web Vitals threshold)
    if (metrics['ttfb'] <= 800) {
      grades['ttfb'] = 'good';
      totalScore += 100;
    } else if (metrics['ttfb'] <= 1800) {
      grades['ttfb'] = 'needs-improvement';
      totalScore += 50;
    } else {
      grades['ttfb'] = 'poor';
      totalScore += 0;
    }
    metricCount++;

    // DNS lookup grading
    if (metrics['dnsLookup'] <= 100) {
      grades['dnsLookup'] = 'good';
      totalScore += 100;
    } else if (metrics['dnsLookup'] <= 300) {
      grades['dnsLookup'] = 'needs-improvement';
      totalScore += 50;
    } else {
      grades['dnsLookup'] = 'poor';
      totalScore += 0;
    }
    metricCount++;

    // TCP connection grading
    if (metrics['tcpConnection'] <= 300) {
      grades['tcpConnection'] = 'good';
      totalScore += 100;
    } else if (metrics['tcpConnection'] <= 1000) {
      grades['tcpConnection'] = 'needs-improvement';
      totalScore += 50;
    } else {
      grades['tcpConnection'] = 'poor';
      totalScore += 0;
    }
    metricCount++;

    // DOM Content Loaded grading
    if (metrics['domContentLoaded'] <= 1500) {
      grades['domContentLoaded'] = 'good';
      totalScore += 100;
    } else if (metrics['domContentLoaded'] <= 3000) {
      grades['domContentLoaded'] = 'needs-improvement';
      totalScore += 50;
    } else {
      grades['domContentLoaded'] = 'poor';
      totalScore += 0;
    }
    metricCount++;

    const score = totalScore / metricCount;

    return { score, grades };
  }
}
