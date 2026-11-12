// The backup file's text, with or without receipt photos. Used by Settings (file, share, Drive) and the Home Drive nudge.
import { makeBackup, type BackupExtra } from "./backup";
import type { Category } from "./categories";
import type { Debt } from "./debts";
import { blobToBase64 } from "./image";
import { allPhotos } from "./store";
import type { Expense, Settings } from "./types";

export async function backupJson(rows: Expense[], learned: Map<string, Category>, settings: Settings, debts: Debt[], extra: BackupExtra, withPhotos: boolean): Promise<string> {
  const photos = withPhotos ? await Promise.all((await allPhotos()).map(async p => ({ id: p.id, type: p.blob.type || "image/jpeg", data: await blobToBase64(p.blob) }))) : [];
  return JSON.stringify(makeBackup(rows, learned, settings, [], debts, { ...extra, photos }));
}
