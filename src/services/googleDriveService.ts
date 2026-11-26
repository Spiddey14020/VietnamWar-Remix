export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export interface DriveActivityEntry {
  timestamp: string;
  actionLabel: string;
  targetName: string;
}

export interface VietnamCloudSavePayload {
  schema: 'vietnam-war-1968-save-v1';
  savedAtIso: string;
  summary: {
    level: number;
    rankTitle: string;
    soldierClass: string;
    factionId: string;
  };
  storage: Record<string, string>;
}

const SAVE_STORAGE_KEYS = [
  'vietnam_war_career_xp_v1',
  'vietnam_war_rpg_profile_v1',
  'vietnam_war_daily_missions_v1',
  'vietnam_war_char_loadout_v1',
  'vietnam_war_custom_camo_v1',
  'vietnam_war_campaign_v1',
] as const;

export const CLOUD_SAVE_MIME = 'application/json';
export const CLOUD_SAVE_PREFIX = 'VietnamWar1968_Save';

export class DriveUnauthorizedError extends Error {
  constructor(message = 'Google Drive session expired. Please sign in again.') {
    super(message);
    this.name = 'DriveUnauthorizedError';
  }
}

async function assertDriveOk(res: Response): Promise<void> {
  if (res.status === 401) {
    throw new DriveUnauthorizedError();
  }
  if (!res.ok) {
    let detail = `Google Drive API error (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      // ignore non-json error
    }
    throw new Error(detail);
  }
}

export function buildLocalSavePayload(summary: VietnamCloudSavePayload['summary']): VietnamCloudSavePayload {
  const storage: Record<string, string> = {};
  for (const key of SAVE_STORAGE_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) {
      storage[key] = val;
    }
  }
  return {
    schema: 'vietnam-war-1968-save-v1',
    savedAtIso: new Date().toISOString(),
    summary,
    storage,
  };
}

export function applyCloudSaveToLocalStorage(rawText: string): VietnamCloudSavePayload {
  const parsed = JSON.parse(rawText) as Partial<VietnamCloudSavePayload>;
  if (parsed.schema !== 'vietnam-war-1968-save-v1' || !parsed.storage || typeof parsed.storage !== 'object') {
    throw new Error('Selected file is not a valid Vietnam War 1968 cloud save.');
  }
  for (const key of SAVE_STORAGE_KEYS) {
    const val = parsed.storage[key];
    if (typeof val === 'string') {
      localStorage.setItem(key, val);
    }
  }
  return parsed as VietnamCloudSavePayload;
}

export async function listDriveFiles(
  accessToken: string,
  options?: { query?: string; savesOnly?: boolean; pageSize?: number },
): Promise<DriveFileItem[]> {
  const clauses: string[] = ['trashed = false'];
  if (options?.savesOnly) {
    clauses.push(`name contains '${CLOUD_SAVE_PREFIX}'`);
  }
  const trimmed = options?.query?.trim();
  if (trimmed) {
    const escaped = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    pageSize: String(options?.pageSize ?? 25),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertDriveOk(res);
  const data = (await res.json()) as { files?: DriveFileItem[] };
  return data.files ?? [];
}

export async function readDriveFileText(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertDriveOk(res);
  return res.text();
}

function buildMultipartBody(metadata: Record<string, unknown>, content: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${CLOUD_SAVE_MIME}; charset=UTF-8`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');
}

export async function createDriveSaveFile(
  accessToken: string,
  fileName: string,
  payload: VietnamCloudSavePayload,
): Promise<DriveFileItem> {
  const boundary = `vw1968_${Date.now()}`;
  const body = buildMultipartBody(
    {
      name: fileName,
      mimeType: CLOUD_SAVE_MIME,
      description: `Vietnam War 1968 Cloud Save (LV ${payload.summary.level} ${payload.summary.rankTitle})`,
    },
    JSON.stringify(payload, null, 2),
    boundary,
  );

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  await assertDriveOk(res);
  return (await res.json()) as DriveFileItem;
}

export async function updateDriveSaveFile(
  accessToken: string,
  fileId: string,
  fileName: string,
  payload: VietnamCloudSavePayload,
): Promise<DriveFileItem> {
  const boundary = `vw1968_upd_${Date.now()}`;
  const body = buildMultipartBody(
    {
      name: fileName,
      description: `Vietnam War 1968 Cloud Save updated ${payload.savedAtIso}`,
    },
    JSON.stringify(payload, null, 2),
    boundary,
  );

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  await assertDriveOk(res);
  return (await res.json()) as DriveFileItem;
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertDriveOk(res);
}

export async function queryDriveActivity(accessToken: string): Promise<DriveActivityEntry[]> {
  const res = await fetch('https://driveactivity.googleapis.com/v2/activity:query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageSize: 10 }),
  });
  await assertDriveOk(res);
  const data = (await res.json()) as {
    activities?: {
      timestamp?: string;
      primaryActionDetail?: Record<string, unknown>;
      targets?: { driveItem?: { title?: string } }[];
    }[];
  };

  return (data.activities ?? []).map((act) => {
    const actionKey = act.primaryActionDetail ? Object.keys(act.primaryActionDetail)[0] : 'update';
    const actionLabel = actionKey ? actionKey.toUpperCase() : 'ACTIVITY';
    const targetName = act.targets?.[0]?.driveItem?.title || 'Drive Item';
    return {
      timestamp: act.timestamp ?? '',
      actionLabel,
      targetName,
    };
  });
}
