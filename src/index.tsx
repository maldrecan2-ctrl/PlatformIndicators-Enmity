import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const { View, Text } = getByProps("View", "Text") || {};
const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      const PresenceStore = getByProps("getState", "getPresence");
      const SessionStore = getByProps("getSessions");
      const UserStore = getByProps("getCurrentUser");

      const getPlatformIcons = (userId: string) => {
          if (!PresenceStore || !UserStore) return null;
          
          let statuses;
          const currentUser = UserStore.getCurrentUser();
          
          // Kendi profilimiz için SessionStore'a bakıyoruz (spoofladığımız cihazı da görebilmek için)
          if (currentUser && userId === currentUser.id && SessionStore) {
              const sessions = SessionStore.getSessions() || {};
              statuses = {};
              Object.values(sessions).forEach((s: any) => {
                  if (s.clientInfo && s.clientInfo.client !== "unknown") {
                      statuses[s.clientInfo.client] = s.status;
                  }
              });
          } else {
              // Diğer kullanıcılar için normal PresenceStore'a bakıyoruz
              statuses = PresenceStore.getState().clientStatuses[userId];
          }
          
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
              <View style={{ flexDirection: 'row', marginLeft: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14 }}>{icons.join(" ")}</Text>
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

                  // Güvenli Enjeksiyon: Bileşenin en dışına sarmalıyoruz ki bozulmasın ve her zaman görünsün.
                  if (res && res.props) {
                      const originalChildren = res.props.children;
                      res.props.children = (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                              <View style={{ flex: 1 }}>{originalChildren}</View>
                              {icons}
                          </View>
                      );
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
                  } else if (res && res.props) {
                      const old = res.props.children;
                      res.props.children = (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {old}
                              {icons}
                          </View>
                      );
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
