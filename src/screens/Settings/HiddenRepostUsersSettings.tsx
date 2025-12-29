import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Pressable, type StyleProp, View, type ViewStyle} from 'react-native'
import {type AppBskyActorDefs as ActorDefs} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {logger} from '#/logger'
import {
  useHiddenRepostUsers,
  useHiddenRepostUsersApi,
} from '#/state/preferences/hidden-repost-users'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfilesQuery} from '#/state/queries/profile'
import {useSetMinimalShellMode} from '#/state/shell'
import {List} from '#/view/com/util/List'
import * as Toast from '#/view/com/util/Toast'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'HiddenRepostUsersSettings'
>

export function HiddenRepostUsersSettingsScreen({}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const setMinimalShellMode = useSetMinimalShellMode()
  const hiddenRepostUsers = useHiddenRepostUsers()
  const {showRepostsFromUser} = useHiddenRepostUsersApi()
  // Use array instead of Set for better React state tracking
  const [selectedDids, setSelectedDids] = useState<string[]>([])
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  // Fetch profiles for all hidden repost user DIDs
  // Note: useProfilesQuery accepts handles but getProfiles API accepts DIDs too
  const {data: profilesData, isLoading} = useProfilesQuery({
    handles: hiddenRepostUsers || [], // DIDs work here too
    maintainData: true,
  })

  const profiles = useMemo(() => {
    if (!profilesData?.profiles) return []
    // Filter to only include profiles that are in our hidden list
    return profilesData.profiles.filter(profile =>
      hiddenRepostUsers?.includes(profile.did),
    )
  }, [profilesData, hiddenRepostUsers])

  // Clean up selectedDids when users are removed (only when hiddenRepostUsers changes)
  const prevHiddenRepostUsersRef = useRef(hiddenRepostUsers)
  const isSelectionModeActiveRef = useRef(isSelectionModeActive)
  isSelectionModeActiveRef.current = isSelectionModeActive

  useEffect(() => {
    const prevHidden = prevHiddenRepostUsersRef.current

    // Only clean up if hiddenRepostUsers actually changed (user was removed)
    if (
      prevHidden &&
      hiddenRepostUsers &&
      prevHidden.length !== hiddenRepostUsers.length
    ) {
      prevHiddenRepostUsersRef.current = hiddenRepostUsers
      // Use a function to get the current selectedDids state
      setSelectedDids(prevSelected => {
        if (prevSelected.length === 0) {
          return prevSelected
        }
        const validDids = new Set(hiddenRepostUsers)
        const filtered = prevSelected.filter(did => validDids.has(did))
        if (filtered.length !== prevSelected.length) {
          // If all selections were removed, exit selection mode
          if (filtered.length === 0 && isSelectionModeActiveRef.current) {
            setIsSelectionModeActive(false)
          }
          return filtered
        }
        return prevSelected
      })
    } else {
      prevHiddenRepostUsersRef.current = hiddenRepostUsers
    }
  }, [hiddenRepostUsers]) // Only depend on hiddenRepostUsers, not isSelectionModeActive

  const isEmpty =
    !isLoading && (!hiddenRepostUsers || hiddenRepostUsers.length === 0)
  const isSelectionMode = isSelectionModeActive

  // Create a stable sorted array and string key for comparisons
  // Compute sorted array and key directly - React will handle re-renders
  const selectedDidsSorted = [...selectedDids].sort()
  const selectedDidsKey = selectedDidsSorted.join(',')
  const selectedDidsArray = selectedDidsSorted

  // Count only selected DIDs that actually exist in the profiles list
  // Use selectedDidsArray for dependency to ensure recalculation when selection changes
  const validSelectedCount = useMemo(() => {
    if (!profiles || profiles.length === 0) {
      console.log(
        '[HiddenRepostUsers] validSelectedCount: no profiles, returning 0',
      )
      return 0
    }
    if (selectedDidsArray.length === 0) {
      console.log(
        '[HiddenRepostUsers] validSelectedCount: no selectedDids, returning 0',
      )
      return 0
    }
    const profileDids = new Set(profiles.map(p => p.did))
    const valid = selectedDidsArray.filter(did => did && profileDids.has(did))
    console.log('[HiddenRepostUsers] validSelectedCount:', {
      selectedDids: selectedDidsArray,
      profileDids: Array.from(profileDids),
      valid,
      count: valid.length,
    })
    return valid.length
  }, [profiles, selectedDidsArray])

  useFocusEffect(
    useCallback(() => {
      setMinimalShellMode(false)
      // Clear selection when screen loses focus
      return () => {
        setSelectedDids([])
        setIsSelectionModeActive(false)
      }
    }, [setMinimalShellMode]),
  )

  const toggleSelection = useCallback((did: string) => {
    console.log('[HiddenRepostUsers] toggleSelection called:', {
      did,
      isSelectionModeActive: isSelectionModeActiveRef.current,
    })
    setSelectedDids(prev => {
      const wasSelected = prev.includes(did)
      const next = wasSelected ? prev.filter(d => d !== did) : [...prev, did]
      console.log('[HiddenRepostUsers] toggleSelection state update:', {
        wasSelected,
        prev: [...prev],
        next: [...next],
      })
      return next
    })
    // Ensure selection mode stays active - use ref to avoid dependency
    if (!isSelectionModeActiveRef.current) {
      console.log(
        '[HiddenRepostUsers] toggleSelection: activating selection mode',
      )
      setIsSelectionModeActive(true)
    }
  }, [])

  const enterSelectionMode = useCallback(() => {
    console.log('[HiddenRepostUsers] enterSelectionMode called')
    // Just activate selection mode without selecting any users
    setIsSelectionModeActive(true)
    setSelectedDids([]) // Clear any stale selections
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedDids([])
    setIsSelectionModeActive(false)
  }, [])

  const removeSelected = useCallback(async () => {
    if (selectedDids.length === 0) return

    const count = selectedDids.length
    setIsRemoving(true)
    try {
      for (const did of selectedDids) {
        showRepostsFromUser({did})
      }
      setSelectedDids([])
      setIsSelectionModeActive(false)
      Toast.show(
        _(
          msg`${count === 1 ? 'User removed' : `${count} users removed`} from hidden reposts list`,
        ),
      )
    } catch (err) {
      logger.error('Failed to remove users from hidden reposts', {message: err})
      Toast.show(_(msg`Failed to remove users`), 'xmark')
    } finally {
      setIsRemoving(false)
    }
  }, [selectedDids, showRepostsFromUser, _])

  const removeSingle = useCallback(
    async (did: string) => {
      setIsRemoving(true)
      try {
        showRepostsFromUser({did})
        Toast.show(_(msg`User removed from hidden reposts list`))
      } catch (err) {
        logger.error('Failed to remove user from hidden reposts', {
          message: err,
        })
        Toast.show(_(msg`Failed to remove user`), 'xmark')
      } finally {
        setIsRemoving(false)
      }
    },
    [showRepostsFromUser, _],
  )

  const renderItem = useCallback(
    ({item, index}: {item: ActorDefs.ProfileView; index: number}) => {
      if (!moderationOpts) return null
      // Check selection using the current selectedDids state
      // selectedDidsKey is in dependency array to ensure this callback updates
      const isSelected = selectedDids.includes(item.did)
      if (index === 0) {
        console.log('[HiddenRepostUsers] renderItem:', {
          itemDid: item.did,
          selectedDids,
          isSelected,
          isSelectionMode,
        })
      }

      return (
        <View
          style={[
            a.py_md,
            a.px_xl,
            a.border_t,
            t.atoms.border_contrast_low,
            isSelected && t.atoms.bg_contrast_25,
          ]}
          key={item.did}>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            {isSelectionMode && (
              <Pressable
                accessibilityRole="button"
                onPress={e => {
                  e?.stopPropagation?.()
                  toggleSelection(item.did)
                }}
                style={[
                  {width: 24, height: 24},
                  a.rounded_full,
                  a.border,
                  t.atoms.border_contrast_high,
                  isSelected && t.atoms.bg,
                  a.align_center,
                  a.justify_center,
                ]}>
                {isSelected && (
                  <CheckIcon
                    size="sm"
                    style={[t.atoms.text_inverted]}
                    fill={t.atoms.text_inverted.color}
                  />
                )}
              </Pressable>
            )}
            <View style={[a.flex_1]}>
              {isSelectionMode ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={e => {
                    e?.stopPropagation?.()
                    toggleSelection(item.did)
                  }}
                  style={[a.flex_1]}>
                  <ProfileCard.Outer>
                    <ProfileCard.Header>
                      <ProfileCard.Avatar
                        profile={item}
                        moderationOpts={moderationOpts}
                      />
                      <ProfileCard.NameAndHandle
                        profile={item}
                        moderationOpts={moderationOpts}
                      />
                    </ProfileCard.Header>
                    <ProfileCard.Labels
                      profile={item}
                      moderationOpts={moderationOpts}
                    />
                    <ProfileCard.Description profile={item} />
                  </ProfileCard.Outer>
                </Pressable>
              ) : (
                <ProfileCard.Link
                  profile={item}
                  testID={`hiddenRepostUser-${index}`}>
                  <ProfileCard.Outer>
                    <ProfileCard.Header>
                      <ProfileCard.Avatar
                        profile={item}
                        moderationOpts={moderationOpts}
                      />
                      <ProfileCard.NameAndHandle
                        profile={item}
                        moderationOpts={moderationOpts}
                      />
                    </ProfileCard.Header>
                    <ProfileCard.Labels
                      profile={item}
                      moderationOpts={moderationOpts}
                    />
                    <ProfileCard.Description profile={item} />
                  </ProfileCard.Outer>
                </ProfileCard.Link>
              )}
            </View>
            {!isSelectionMode && (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeSingle(item.did)}
                disabled={isRemoving}
                style={[
                  a.p_md,
                  a.rounded_full,
                  t.atoms.bg_contrast_25,
                  isRemoving && {opacity: 0.5},
                ]}>
                <TrashIcon size="md" style={[t.atoms.text_contrast_high]} />
              </Pressable>
            )}
          </View>
        </View>
      )
    },
    [
      moderationOpts,
      selectedDids, // Use the array directly - React will detect reference changes
      isSelectionMode,
      toggleSelection,
      removeSingle,
      isRemoving,
      t,
    ],
  )

  return (
    <Layout.Screen testID="hiddenRepostUsersSettingsScreen">
      <Layout.Center>
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Hidden Repost Users</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot>
            {!isEmpty && (
              <Button
                label={isSelectionMode ? _(msg`Cancel`) : _(msg`Select`)}
                size="small"
                variant="ghost"
                color="secondary"
                onPress={isSelectionMode ? clearSelection : enterSelectionMode}>
                <ButtonText>
                  {isSelectionMode ? (
                    <Trans>Cancel</Trans>
                  ) : (
                    <Trans>Select</Trans>
                  )}
                </ButtonText>
              </Button>
            )}
          </Layout.Header.Slot>
        </Layout.Header.Outer>
        {(() => {
          console.log('[HiddenRepostUsers] Banner render check:', {
            isSelectionMode,
            validSelectedCount,
            selectedDids,
            shouldShow: isSelectionMode,
          })
          return null
        })()}
        {isSelectionMode && (
          <View
            style={[
              a.flex_row,
              a.justify_between,
              a.align_center,
              a.px_xl,
              a.py_md,
              a.border_b,
              t.atoms.border_contrast_low,
              t.atoms.bg_contrast_25,
            ]}>
            <Text style={[a.text_md, t.atoms.text_contrast_high]}>
              <Trans>
                {validSelectedCount === 0
                  ? 'No users selected'
                  : validSelectedCount === 1
                    ? '1 user selected'
                    : `${validSelectedCount} users selected`}
              </Trans>
            </Text>
            <Button
              label={_(msg`Remove selected`)}
              size="small"
              color="negative"
              variant="solid"
              onPress={removeSelected}
              disabled={
                isRemoving ||
                validSelectedCount === 0 ||
                selectedDids.length === 0
              }>
              <ButtonText>
                <Trans>Remove</Trans>
              </ButtonText>
            </Button>
          </View>
        )}
        {isEmpty ? (
          <View>
            <Info style={[a.border_b]} />
            <Empty />
          </View>
        ) : (
          <List
            data={profiles}
            keyExtractor={item => item.did}
            renderItem={renderItem}
            initialNumToRender={15}
            ListHeaderComponent={Info}
            extraData={`${isSelectionModeActive}-${selectedDidsKey}`}
          />
        )}
      </Layout.Center>
    </Layout.Screen>
  )
}

function Empty() {
  const t = useTheme()
  return (
    <View style={[a.pt_2xl, a.px_xl, a.align_center]}>
      <View
        style={[
          a.py_md,
          a.px_lg,
          a.rounded_sm,
          t.atoms.bg_contrast_25,
          a.border,
          t.atoms.border_contrast_low,
          {maxWidth: 400},
        ]}>
        <Text style={[a.text_sm, a.text_center, t.atoms.text_contrast_high]}>
          <Trans>
            You have not hidden reposts from any users yet. To hide reposts from
            a user, open the menu on one of their reposts and select "Hide
            reposts from this user".
          </Trans>
        </Text>
      </View>
    </View>
  )
}

function Info({style}: {style?: StyleProp<ViewStyle>}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.w_full,
        t.atoms.bg_contrast_25,
        a.py_md,
        a.px_xl,
        a.border_t,
        {marginTop: a.border.borderWidth * -1},
        t.atoms.border_contrast_low,
        style,
      ]}>
      <Text style={[a.text_center, a.text_sm, t.atoms.text_contrast_high]}>
        <Trans>
          Reposts from these users will be hidden from your Following feed and
          list feeds. This setting is stored locally on your device.
        </Trans>
      </Text>
    </View>
  )
}
