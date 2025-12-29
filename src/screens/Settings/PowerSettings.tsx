import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useHiddenRepostUsers} from '#/state/preferences/hidden-repost-users'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a} from '#/alf'
import {Repost_Stroke2_Corner2_Rounded as RepostIcon} from '#/components/icons/Repost'
import * as Layout from '#/components/Layout'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PowerSettings'>
export function PowerSettingsScreen({}: Props) {
  const {_} = useLingui()
  const hiddenRepostUsers = useHiddenRepostUsers()
  const hasHiddenUsers = hiddenRepostUsers && hiddenRepostUsers.length > 0

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Power Settings</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.LinkItem
            to="/settings/hidden-repost-users"
            label={_(msg`Hidden repost users`)}>
            <SettingsList.ItemIcon icon={RepostIcon} />
            <SettingsList.ItemText>
              <Trans>Hidden repost users</Trans>
            </SettingsList.ItemText>
            {hasHiddenUsers && (
              <SettingsList.ItemText
                style={[a.text_sm, a.text_contrast_medium]}>
                {hiddenRepostUsers.length === 1 ? (
                  <Trans>1 user</Trans>
                ) : (
                  <Trans>{hiddenRepostUsers.length} users</Trans>
                )}
              </SettingsList.ItemText>
            )}
          </SettingsList.LinkItem>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}
