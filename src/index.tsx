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
      // Olabildiğince çok alternatifle Store'ları arıyoruz
      let PresenceStore = getByProps("getState", "getPresence") || getByProps("getStatus", "getActivities");
      let SessionStore = getByProps("getSessions") || getByProps("getSession");
      let UserStore = getByProps("getCurrentUser") || getByProps("getUser", "getUsers");

      if (!PresenceStore) {
          try { PresenceStore = (window as any).enmity?.metro?.getByStoreName?.("PresenceStore"); } catch(e){}
      }
      if (!UserStore) {
          try { UserStore = (window as any).enmity?.metro?.getByStoreName?.("UserStore"); } catch(e){}
      }
      if (!SessionStore) {
          try { SessionStore = (window as any).enmity?.metro?.getByStoreName?.("SessionsStore"); } catch(e){}
      }

      const getPlatformIcons = (userId: string) => {
          // DEBUG: Eğer Store'lar bulunamadıysa kırmızı bir soru işareti gösterelim
          // Bu sayede UI yamasının çalışıp çalışmadığını ama veritabanının eksik olduğunu anlarız.
          if (!PresenceStore || !UserStore) {
              return <Text style={{ color: 'red', fontSize: 12 }}> [?] </Text>;
          }
          
          let statuses;
          try {
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
                  const state = PresenceStore.getState();
                  if (state && state.clientStatuses) {
                      statuses = state.clientStatuses[userId];
                  }
              }
          } catch(e) {
              return <Text style={{ color: 'orange', fontSize: 12 }}> [!] </Text>; // Okurken hata çıktı
          }
          
          if (!statuses) return null; // Çevrimdışı veya durum yok
          
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
              <View style={{ flexDirection: 'row', marginLeft: 4, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12 }}>{icons.join(" ")}</Text>
              </View>
          );
      };

      // 1. Üyeler Listesi (GuildMemberRow)
      const GuildMemberModule = getByProps("GuildMemberRow");
      if (GuildMemberModule) {
          const patchFunc = GuildMemberModule.GuildMemberRow ? "GuildMemberRow" : (GuildMemberModule.default ? "default" : null);
          if (patchFunc) {
              Patcher.after(GuildMemberModule, patchFunc as any, (self, args, res) => {
                  try {
                      const user = args[0]?.user;
                      if (!user) return res;

                      const icons = getPlatformIcons(user.id);
                      if (!icons) return res;

                      if (res && res.props) {
                          const originalChildren = res.props.children;
                          res.props.children = (
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 4 }}>
                                  <View style={{ flex: 1 }}>{originalChildren}</View>
                                  {icons}
                              </View>
                          );
                      }
                  } catch (e) {}
                  return res;
              });
          }
      }

      // 2. Kullanıcı Satırı (UserRow)
      const UserRowModule = getByProps("UserRow");
      if (UserRowModule) {
          const patchFunc = UserRowModule.UserRow ? "UserRow" : (UserRowModule.default ? "default" : null);
          if (patchFunc) {
              Patcher.after(UserRowModule, patchFunc as any, (self, args, res) => {
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
                  } catch (e) {}
                  return res;
              });
          }
      }

      // 3. Sohbet Mesajı İsimleri (MessageHeader / MessageTimestamp)
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
                  } else if (res && res.props) {
                      const originalChildren = res.props.children;
                      res.props.children = (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {originalChildren}
                              {icons}
                          </View>
                      );
                  }
              } catch(e) {}
              return res;
          });
      }
      
      // 4. Profil Sayfası İsmi (DisplayName)
      const DisplayName = getByProps("DisplayName");
      if (DisplayName && DisplayName.default) {
          Patcher.after(DisplayName, "default", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;

                  const icons = getPlatformIcons(user.id);
                  if (!icons) return res;

                  if (res && res.props) {
                      const originalChildren = res.props.children;
                      res.props.children = (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {originalChildren}
                              {icons}
                          </View>
                      );
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
