// app/manual-albums-store.ts

export type ManualAlbumSnapshot = {
  id: string;
  title: string;
  createdAt: string;
  count: number;
  coverUri?: string;
};

let snapshots: ManualAlbumSnapshot[] = [];
const listeners = new Set<(next: ManualAlbumSnapshot[]) => void>();

export function getManualAlbumSnapshots(): ManualAlbumSnapshot[] {
  return snapshots;
}

export function setManualAlbumSnapshots(next: ManualAlbumSnapshot[]) {
  snapshots = next;
  for (const listener of listeners) {
    listener(snapshots);
  }
}

export function subscribeManualAlbumSnapshots(
  listener: (next: ManualAlbumSnapshot[]) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
