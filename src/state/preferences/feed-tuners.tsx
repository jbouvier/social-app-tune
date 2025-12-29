import {useMemo} from 'react'

import {FeedTuner} from '#/lib/api/feed-manip'
import {type FeedDescriptor} from '../queries/post-feed'
import {usePreferencesQuery} from '../queries/preferences'
import {useSession} from '../session'
import {useHiddenRepostUsers} from './hidden-repost-users'
import {useLanguagePrefs} from './languages'

export function useFeedTuners(feedDesc: FeedDescriptor) {
  const langPrefs = useLanguagePrefs()
  const {data: preferences} = usePreferencesQuery()
  const {currentAccount} = useSession()
  const hiddenRepostUsers = useHiddenRepostUsers()

  return useMemo(() => {
    if (feedDesc.startsWith('author')) {
      if (feedDesc.endsWith('|posts_with_replies')) {
        // TODO: Do this on the server instead.
        return [FeedTuner.removeReposts]
      }
    }
    if (feedDesc.startsWith('feedgen')) {
      return [
        FeedTuner.preferredLangOnly(langPrefs.contentLanguages),
        FeedTuner.removeMutedThreads,
      ]
    }
    if (feedDesc === 'following' || feedDesc.startsWith('list')) {
      const feedTuners = [FeedTuner.removeOrphans]

      if (preferences?.feedViewPrefs.hideReposts) {
        feedTuners.push(FeedTuner.removeReposts)
      } else {
        // Only apply per-user repost hiding if global hideReposts is disabled
        const hiddenDids = hiddenRepostUsers || []
        if (hiddenDids.length > 0) {
          feedTuners.push(FeedTuner.removeRepostsFromUsers(hiddenDids))
        }
      }
      if (preferences?.feedViewPrefs.hideReplies) {
        feedTuners.push(FeedTuner.removeReplies)
      } else {
        feedTuners.push(
          FeedTuner.followedRepliesOnly({
            userDid: currentAccount?.did || '',
          }),
        )
      }
      if (preferences?.feedViewPrefs.hideQuotePosts) {
        feedTuners.push(FeedTuner.removeQuotePosts)
      }
      feedTuners.push(FeedTuner.dedupThreads)
      feedTuners.push(FeedTuner.removeMutedThreads)

      return feedTuners
    }
    return []
  }, [feedDesc, currentAccount, preferences, langPrefs, hiddenRepostUsers])
}
