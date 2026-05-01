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
      // API'den doğrudan getiremediğimiz Store'ları Enmity'nin global objesi üzerinden adlarıyla kesin olarak alıyoruz
      const getStore = (name: string) => {
          try {
              return (window as any).enmity?.metro?.getByStoreName?.(name) || null;
          } catch (e) {
              return null;
          }
      };

      const PresenceStore = getStore("PresenceStore");
      const SessionStore = getStore("SessionsStore");
      const UserStore = getStore("UserStore");

      const getPlatformIcons = (userId: string) => {
          if (!PresenceStore || !UserStore) return null;
          
          let statuses;
          const currentUser = UserStore.getCurrentUser();
          
          if (currentUser && userId === currentUser.id && SessionStore) {
              const sessions = SessionStore.getSessions() || {};
              statuses = {};
              Object.values(sessions).forEach((s: any) => {
                  if (s.clientInfo && s.clientInfo.client !== "unknown") {
                      statuses[s.clientInfo.client] = s.status;
                  }
              });
          } else {
              // Diğer kullanıcılar
              const state = PresenceStore.getState();
              if (state && state.clientStatuses) {
                  statuses = state.clientStatuses[userId];
              }
          }
          
          if (!statuses) return null;
          
          const platforms = Object.keys(statuses);
          if (platforms.length === 0) return null;
          
          let icons = [];
          if (platforms.includes("desktop")) icons.push("💻");
          if (platforms.includes("web")) icons.push("🌐");
          if (platforms.includes("mobile")) icons.push("📱");
          if (platforms.includes("embedded")) icons.push("🎮");
          if (platforms.includes("vr")) icons.push("🥽");
          
          if (icons.length === 0) return null;

          return (
              <View style={{ flexDirection: 'row', marginLeft: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14 }}>{icons.join(" ")}</Text>
              </View>
          );
      };

      // Üyeler Listesi (Member List) Yaması - Orijinal Vendetta yöntemini kullanıyoruz
      const GuildMemberRow = getByProps("GuildMemberRow");
      if (GuildMemberRow && GuildMemberRow.GuildMemberRow) {
          Patcher.after(GuildMemberRow, "GuildMemberRow", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;

                  const icons = getPlatformIcons(user.id);
                  if (!icons) return res;

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

      // Ayrıca UserRow kullanan daha yeni versiyonlar için yedek yama
      try {
          const enmityMetro = (window as any).enmity?.metro;
          if (enmityMetro && enmityMetro.findByTypeNameAll) {
              const UserRows = enmityMetro.findByTypeNameAll("UserRow");
              UserRows.forEach((UserRow: any) => {
                  Patcher.after(UserRow, "type", (self, args, res) => {
                      try {
                          const user = args[0]?.user;
                          if (!user) return res;
                          const icons = getPlatformIcons(user.id);
                          if (!icons) return res;

                          if (res && res.props) {
                              const originalChildren = res.props.children;
                              res.props.children = (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                      <View style={{ flex: 1 }}>{originalChildren}</View>
                                      {icons}
                                  </View>
                              );
                          }
                      } catch(e) {}
                      return res;
                  });
              });
          }
      } catch(e) {}

      // Sohbet içi mesajlarda ismi değiştiren yedek yama (chatte görünmesi için)
      const MessageHeader = getByProps("MessageTimestamp");
      if (MessageHeader && MessageHeader.default) {
          Patcher.after(MessageHeader, "default", (self, args, res) => {
              try {
                  const message = args[0]?.message;
                  if (!message || !message.author) return res;
                  
                  const icons = getPlatformIcons(message.author.id);
                  if (!icons) return res;

                  if (res && res.props && Array.isArray(res.props.children)) {
                      res.props.children.push(icons);
                  }
              } catch(e) {}
              return res;
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
