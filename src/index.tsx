import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';
const { View, Text } = getByProps("View", "Text") || {};

const Patcher = create('PlatformIndicators');

function findInReactTree(tree: any, filter: (node: any) => boolean): any {
    if (!tree) return null;
    if (filter(tree)) return tree;
    if (Array.isArray(tree)) {
        for (const child of tree) {
            const found = findInReactTree(child, filter);
            if (found) return found;
        }
    } else if (tree.props && tree.props.children) {
        return findInReactTree(tree.props.children, filter);
    }
    return null;
}

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      const PresenceStore = getByProps("getState", "getPresence");

      const getPlatformIcons = (userId: string) => {
          if (!PresenceStore) return null;
          const statuses = PresenceStore.getState().clientStatuses[userId];
          if (!statuses) return null;
          
          const platforms = Object.keys(statuses);
          if (platforms.length === 0) return null;
          
          let icons = [];
          if (platforms.includes("desktop")) icons.push("💻");
          if (platforms.includes("web")) icons.push("🌐");
          if (platforms.includes("mobile")) icons.push("📱");
          if (platforms.includes("embedded")) icons.push("🎮");
          
          if (icons.length === 0) return null;

          return (
              <View style={{ flexDirection: 'row', marginLeft: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>{icons.join(" ")}</Text>
              </View>
          );
      };

      // 1. Üyeler Listesi (Member List) Yaması
      const GuildMemberRow = getByProps("GuildMemberRow");
      if (GuildMemberRow && GuildMemberRow.GuildMemberRow) {
          Patcher.after(GuildMemberRow, "GuildMemberRow", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;

                  const icons = getPlatformIcons(user.id);
                  if (!icons) return res;

                  // Üye isminin yanına eklemeye çalış
                  const statusView = findInReactTree(res, (node) => node?.props?.style?.flexDirection === "row");
                  if (statusView && statusView.props && Array.isArray(statusView.props.children)) {
                      statusView.props.children.push(icons);
                  }
              } catch (e) {}
              return res;
          });
      }

      // 2. Profil Sayfası Yaması
      const UserProfile = getByProps("DisplayName");
      if (UserProfile && UserProfile.default) {
          Patcher.after(UserProfile, "default", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;

                  const icons = getPlatformIcons(user.id);
                  if (!icons) return res;

                  if (res && res.props && Array.isArray(res.props.children)) {
                      res.props.children.push(icons);
                  }
              } catch (e) {}
              return res;
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
