import type {
  FeatureFlag,
  CreateFlagPayload,
  UpdateRolloutPayload,
  EvaluationContext,
  EvaluationResult,
  FlagStats,
  ApiResponse,
} from '../../../shared/types.js';

// BASE_URL is '/' for the real app, so this resolves to '/api'.
const API_BASE = `${import.meta.env.BASE_URL}api`;

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchFlags(): Promise<FeatureFlag[]> {
  const res = await fetch(`${API_BASE}/flags`);
  const json: ApiResponse<FeatureFlag[]> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch flags');
  return json.data;
}

export async function fetchFlagByKey(key: string): Promise<FeatureFlag> {
  const res = await fetch(`${API_BASE}/flags/${key}`);
  const json: ApiResponse<FeatureFlag> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch flag');
  return json.data;
}

export async function createFlag(payload: CreateFlagPayload): Promise<FeatureFlag> {
  const res = await fetch(`${API_BASE}/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json: ApiResponse<FeatureFlag> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Failed to create flag');
  return json.data;
}

export async function updateRollout(
  key: string,
  payload: UpdateRolloutPayload
): Promise<FeatureFlag> {
  const res = await fetch(`${API_BASE}/flags/${key}/rollout`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json: ApiResponse<FeatureFlag> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Failed to update rollout');
  return json.data;
}

export async function toggleKillSwitch(
  key: string,
  environment: string,
  active: boolean
): Promise<FeatureFlag> {
  const res = await fetch(`${API_BASE}/flags/${key}/killswitch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ environment, active }),
  });
  const json: ApiResponse<FeatureFlag> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Failed to toggle kill switch');
  return json.data;
}

export async function evaluateFlag(
  key: string,
  environment: string,
  context: EvaluationContext
): Promise<EvaluationResult> {
  const res = await fetch(`${API_BASE}/flags/${key}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ environment, context }),
  });
  const json: ApiResponse<EvaluationResult> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Evaluation failed');
  return json.data;
}

export async function fetchStats(key: string): Promise<FlagStats> {
  const res = await fetch(`${API_BASE}/flags/${key}/stats`);
  const json: ApiResponse<FlagStats> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch stats');
  return json.data;
}

export async function deleteFlag(key: string): Promise<void> {
  const res = await fetch(`${API_BASE}/flags/${key}`, { method: 'DELETE' });
  const json: ApiResponse<{ deleted: boolean }> = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete flag');
}
