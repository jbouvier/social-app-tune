import {useCallback, useEffect, useMemo, useState} from 'react'
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
import {CheckThick_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'HiddenRepostUsersSettings'
>

function Checkbox({checked, onPress}: {checked: boolean; onPress: () => void}) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{checked}}
      onPress={onPress}
      style={[
        {
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 1,
        },
        a.justify_center,
        a.align_center,
        checked
          ? {
              backgroundColor: t.palette.primary_500,
              borderColor: t.palette.primary_500,
            }
          : {
              backgroundColor: t.palette.contrast_25,
              borderColor: t.palette.contrast_100,
            },
      ]}>
      {checked && <CheckIcon width={14} fill={t.palette.white} />}
    </Pressable>
  )
}

function HiddenRepostUserItem({
  profile,
  index,
  isSelected,
  isSelectionMode,
  moderationOpts,
  onToggleSelection,
  onRemove,
  isRemoving,
}: {
  profile: ActorDefs.ProfileView
  index: number
  isSelected: boolean
  isSelectionMode: boolean
  moderationOpts: ReturnType<typeof useModerationOpts> | null
  onToggleSelection: (did: string) => void
  onRemove: (did: string) => void
  isRemoving: boolean
}) {
  const t = useTheme()

  const handleToggle = (e?: any) => {
    e?.stopPropagation?.()
    onToggleSelection(profile.did)
  }

  if (!moderationOpts) return null

  return (
    <View
      style={[
        a.py_md,
        a.px_xl,
        a.border_t,
        t.atoms.border_contrast_low,
        isSelected && t.atoms.bg_contrast_25,
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        {isSelectionMode && (
          <Checkbox checked={isSelected} onPress={handleToggle} />
        )}
        <View style={[a.flex_1]}>
          {isSelectionMode ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleToggle}
              style={[a.flex_1]}>
              <ProfileCard.Outer>
                <ProfileCard.Header>
                  <ProfileCard.Avatar
                    profile={profile}
                    moderationOpts={moderationOpts}
                  />
                  <ProfileCard.NameAndHandle
                    profile={profile}
                    moderationOpts={moderationOpts}
                  />
                </ProfileCard.Header>
                <ProfileCard.Labels
                  profile={profile}
                  moderationOpts={moderationOpts}
                />
                <ProfileCard.Description profile={profile} />
              </ProfileCard.Outer>
            </Pressable>
          ) : (
            <ProfileCard.Link
              profile={profile}
              testID={`hiddenRepostUser-${index}`}>
              <ProfileCard.Outer>
                <ProfileCard.Header>
                  <ProfileCard.Avatar
                    profile={profile}
                    moderationOpts={moderationOpts}
                  />
                  <ProfileCard.NameAndHandle
                    profile={profile}
                    moderationOpts={moderationOpts}
                  />
                </ProfileCard.Header>
                <ProfileCard.Labels
                  profile={profile}
                  moderationOpts={moderationOpts}
                />
                <ProfileCard.Description profile={profile} />
              </ProfileCard.Outer>
            </ProfileCard.Link>
          )}
        </View>
        {!isSelectionMode && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onRemove(profile.did)}
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
}

export function HiddenRepostUsersSettingsScreen({}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const setMinimalShellMode = useSetMinimalShellMode()
  const hiddenRepostUsers = useHiddenRepostUsers()
  const {showRepostsFromUser} = useHiddenRepostUsersApi()
  // Use Set for O(1) lookups, convert to array when needed
  const [selectedDidsSet, setSelectedDidsSet] = useState<Set<string>>(new Set())
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  // Fetch profiles for all hidden repost user DIDs
  const {data: profilesData, isLoading} = useProfilesQuery({
    handles: hiddenRepostUsers || [],
    maintainData: true,
  })

  const profiles = useMemo(() => {
    if (!profilesData?.profiles) return []
    // Filter to only include profiles that are in our hidden list
    const hiddenSet = new Set(hiddenRepostUsers || [])
    return profilesData.profiles.filter(profile => hiddenSet.has(profile.did))
  }, [profilesData, hiddenRepostUsers])

  // Clean up selected DIDs when users are removed
  useEffect(() => {
    if (!hiddenRepostUsers || hiddenRepostUsers.length === 0) {
      setSelectedDidsSet(prev => {
        if (prev.size > 0) {
          setIsSelectionModeActive(false)
          return new Set()
        }
        return prev
      })
      return
    }

    const hiddenSet = new Set(hiddenRepostUsers)
    setSelectedDidsSet(prev => {
      const filtered = new Set(
        Array.from(prev).filter(did => hiddenSet.has(did)),
      )
      // If all selections were removed, exit selection mode
      if (filtered.size === 0 && prev.size > 0) {
        setIsSelectionModeActive(false)
      }
      return filtered.size !== prev.size ? filtered : prev
    })
  }, [hiddenRepostUsers])

  const isEmpty =
    !isLoading && (!hiddenRepostUsers || hiddenRepostUsers.length === 0)
  const isSelectionMode = isSelectionModeActive

  // Convert Set to array for rendering and counting
  const selectedDidsArray = useMemo(
    () => Array.from(selectedDidsSet),
    [selectedDidsSet],
  )

  // Count only selected DIDs that actually exist in the profiles list
  const validSelectedCount = useMemo(() => {
    if (!profiles || profiles.length === 0) return 0
    if (selectedDidsSet.size === 0) return 0
    const profileDids = new Set(profiles.map(p => p.did))
    return Array.from(selectedDidsSet).filter(did => profileDids.has(did))
      .length
  }, [profiles, selectedDidsSet])

  useFocusEffect(
    useCallback(() => {
      setMinimalShellMode(false)
      // Clear selection when screen loses focus
      return () => {
        setSelectedDidsSet(new Set())
        setIsSelectionModeActive(false)
      }
    }, [setMinimalShellMode]),
  )

  const toggleSelection = useCallback(
    (did: string) => {
      setSelectedDidsSet(prev => {
        const next = new Set(prev)
        if (next.has(did)) {
          next.delete(did)
        } else {
          next.add(did)
        }
        return next
      })
      // Ensure selection mode stays active
      if (!isSelectionModeActive) {
        setIsSelectionModeActive(true)
      }
    },
    [isSelectionModeActive],
  )

  const enterSelectionMode = useCallback(() => {
    setIsSelectionModeActive(true)
    setSelectedDidsSet(new Set()) // Clear any stale selections
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedDidsSet(new Set())
    setIsSelectionModeActive(false)
  }, [])

  const removeSelected = useCallback(async () => {
    if (selectedDidsSet.size === 0) return

    const count = selectedDidsSet.size
    const didsToRemove = Array.from(selectedDidsSet)
    setIsRemoving(true)
    try {
      for (const did of didsToRemove) {
        showRepostsFromUser({did})
      }
      setSelectedDidsSet(new Set())
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
  }, [selectedDidsSet, showRepostsFromUser, _])

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

  // Memoize extraData to ensure FlatList re-renders when selection changes
  const listExtraData = useMemo(
    () =>
      `${isSelectionModeActive}-${selectedDidsArray.join(',')}-${selectedDidsSet.size}`,
    [isSelectionModeActive, selectedDidsArray, selectedDidsSet.size],
  )

  // Key extractor
  const keyExtractor = useCallback(
    (item: ActorDefs.ProfileView) => item.did,
    [],
  )

  const renderItem = useCallback(
    ({item, index}: {item: ActorDefs.ProfileView; index: number}) => {
      if (!moderationOpts) return null
      return (
        <HiddenRepostUserItem
          profile={item}
          index={index}
          isSelected={selectedDidsSet.has(item.did)}
          isSelectionMode={isSelectionMode}
          moderationOpts={moderationOpts}
          onToggleSelection={toggleSelection}
          onRemove={removeSingle}
          isRemoving={isRemoving}
        />
      )
    },
    [
      selectedDidsSet,
      isSelectionMode,
      moderationOpts,
      toggleSelection,
      removeSingle,
      isRemoving,
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
              disabled={isRemoving || validSelectedCount === 0}>
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
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            initialNumToRender={15}
            ListHeaderComponent={Info}
            extraData={listExtraData}
            removeClippedSubviews={false}
            windowSize={10}
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
