# IndexedDB Persistence for Images

## Goal
Store received images locally in the browser's IndexedDB so they persist across page reloads and hard refreshes, preventing data loss if the user accidentally closes or refreshes the tab.

## Proposed Changes

### 1. New File: IndexedDB Wrapper
#### [NEW] `lib/webrtc/db.ts`
- Create a Promise-based wrapper around the native browser `indexedDB` API.
- Define a database `ClipYardDB` with an `images` object store.
- **Store Schema:**
  - `id` (Primary Key, string) - The `transferId`
  - `roomId` (Index, string) - The room where the image was shared
  - `fileName` (string)
  - `fileSize` (number)
  - `mimeType` (string)
  - `blob` (Blob) - The actual binary image data
  - `createdAt` (number)
  - `peerId` (string)
  - `peerName` (string)
- **Functions:**
  - `initDB()`: Open/upgrade the database.
  - `saveImage(image: StoredImage)`: Save a new image to the DB.
  - `getImagesByRoom(roomId: string)`: Retrieve all images for a specific room.

### 2. Update Image Transfer Hook
#### [MODIFY] `hooks/useImageTransfer.ts`
- **On Mount (`useEffect`):** Fetch all previously received images for the current `roomId` from IndexedDB using `getImagesByRoom(roomId)`.
- Reconstruct the `Transfer` objects (with `status: 'completed'` and `direction: 'received'`) and inject them into the `transfers` state array.
- Create `ObjectURL`s for these loaded blobs so the UI can render them immediately.
- **On Transfer Complete (`onComplete` callback):** When a new image is fully received over WebRTC, asynchronously call `saveImage()` to store it in IndexedDB.

### 3. Verification Plan
- Start the dev server.
- Connect two peers in a room and send an image.
- Refresh the tab of the receiving peer.
- **Expected Result:** The received image is immediately loaded from IndexedDB and displays in the "Received Images" section without needing to be re-sent.

> [!NOTE]
> Since we are only storing images locally in the user's browser, there are no backend Firebase changes required. The storage limit depends on the user's browser quota (typically hundreds of MBs to GBs).
