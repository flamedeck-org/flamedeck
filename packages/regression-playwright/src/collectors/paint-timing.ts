import type { Page } from '@playwright/test';
import type { PaintMetrics } from '../types/playwright-metrics';

/**
 * Paint Timing collector based on the Paint Timing API
 * https://www.checklyhq.com/learn/playwright/performance/
 */
export class PaintTimingCollector {
  /**
   * Collect all paint timing metrics from a page
   */
  static async collectPaintTiming(page: Page): Promise<PaintMetrics> {
    const paintData = await page.evaluate(() => {
      const paintTimingJson = JSON.stringify(window.performance.getEntriesByType('paint'));
      return JSON.parse(paintTimingJson);
    });

    if (!paintData || paintData.length === 0) {
      return { fp: 0, fcp: 0 };
    }

    const fpEntry = paintData.find((entry: any) => entry.name === 'first-paint');
    const fcpEntry = paintData.find((entry: any) => entry.name === 'first-contentful-paint');

    return {
      fp: fpEntry?.startTime || 0,
      fcp: fcpEntry?.startTime || 0,
    };
  }

  /**
   * Get First Paint (FP) specifically
   */
  static async getFirstPaint(page: Page): Promise<number> {
    return page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const fpEntry = paintEntries.find((entry) => entry.name === 'first-paint');
      return fpEntry?.startTime || 0;
    });
  }

  /**
   * Get First Contentful Paint (FCP) specifically
   */
  static async getFirstContentfulPaint(page: Page): Promise<number> {
    return page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
      return fcpEntry?.startTime || 0;
    });
  }

  /**
   * Wait for paint timing to be available
   */
  static async waitForPaintTiming(page: Page, timeout: number = 5000): Promise<void> {
    await page.waitForFunction(
      () => {
        const paintEntries = performance.getEntriesByType('paint');
        return paintEntries && paintEntries.length > 0;
      },
      { timeout }
    );
  }

  /**
   * Check if paint timing is supported
   */
  static async isPaintTimingSupported(page: Page): Promise<{
    firstPaint: boolean;
    firstContentfulPaint: boolean;
  }> {
    return page.evaluate(() => {
      if (!('performance' in window) || !('getEntriesByType' in performance)) {
        return { firstPaint: false, firstContentfulPaint: false };
      }

      const paintEntries = performance.getEntriesByType('paint');
      const hasFirstPaint = paintEntries.some((entry) => entry.name === 'first-paint');
      const hasFirstContentfulPaint = paintEntries.some(
        (entry) => entry.name === 'first-contentful-paint'
      );

      return {
        firstPaint: hasFirstPaint,
        firstContentfulPaint: hasFirstContentfulPaint,
      };
    });
  }

  /**
   * Get detailed paint timing information
   */
  static async getDetailedPaintTiming(page: Page): Promise<{
    paintEntries: Array<{
      name: string;
      startTime: number;
      duration: number;
    }>;
    timeToFirstPaint: number;
    timeToFirstContentfulPaint: number;
    fcpMinusFp: number;
  }> {
    return page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const entries = paintEntries.map((entry) => ({
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration,
      }));

      const fpEntry = paintEntries.find((entry) => entry.name === 'first-paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

      const timeToFirstPaint = fpEntry?.startTime || 0;
      const timeToFirstContentfulPaint = fcpEntry?.startTime || 0;
      const fcpMinusFp = timeToFirstContentfulPaint - timeToFirstPaint;

      return {
        paintEntries: entries,
        timeToFirstPaint,
        timeToFirstContentfulPaint,
        fcpMinusFp,
      };
    });
  }

  /**
   * Calculate paint timing score based on Core Web Vitals thresholds
   */
  static calculatePaintScore(metrics: PaintMetrics): {
    score: number;
    grades: {
      fcp: 'good' | 'needs-improvement' | 'poor';
      fp: 'good' | 'needs-improvement' | 'poor';
    };
  } {
    const grades = {
      fcp: 'good' as 'good' | 'needs-improvement' | 'poor',
      fp: 'good' as 'good' | 'needs-improvement' | 'poor',
    };

    let totalScore = 0;
    let metricCount = 0;

    // First Contentful Paint grading (Core Web Vitals)
    if (metrics['fcp'] <= 1800) {
      grades.fcp = 'good';
      totalScore += 100;
    } else if (metrics['fcp'] <= 3000) {
      grades.fcp = 'needs-improvement';
      totalScore += 50;
    } else {
      grades.fcp = 'poor';
      totalScore += 0;
    }
    metricCount++;

    // First Paint grading (similar thresholds)
    if (metrics['fp'] <= 1500) {
      grades.fp = 'good';
      totalScore += 100;
    } else if (metrics['fp'] <= 2500) {
      grades.fp = 'needs-improvement';
      totalScore += 50;
    } else {
      grades.fp = 'poor';
      totalScore += 0;
    }
    metricCount++;

    const score = totalScore / metricCount;

    return { score, grades };
  }
}
