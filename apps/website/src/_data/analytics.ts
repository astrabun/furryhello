export interface AnalyticsData {
  enabled: boolean;
  baseUrl: string | undefined;
  projectId: string | undefined;
}

export default function (): AnalyticsData {
  const baseUrl = process.env.SWETRIX_BASE_URL;
  const projectId = process.env.SWETRIX_PROJECT_ID;

  return {
    enabled: Boolean(baseUrl && projectId),
    baseUrl,
    projectId,
  };
}
