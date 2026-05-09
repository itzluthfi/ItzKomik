import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { getBookmarks } from '@/src/store/bookmarks';
import { checkUpdatesForBookmarks } from '@/src/store/updates';

const BACKGROUND_FETCH_TASK = 'background-fetch-updates';

try {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    try {
      const bookmarks = await getBookmarks();
      if (bookmarks.length === 0) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      
      const res = await checkUpdatesForBookmarks(bookmarks);
      
      if (res.updates.length > 0) {
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (err) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  // Silent catch untuk Expo Go
}

export async function registerBackgroundFetchAsync() {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 60 * 60 * 3, // 3 hours
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function unregisterBackgroundFetchAsync() {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
