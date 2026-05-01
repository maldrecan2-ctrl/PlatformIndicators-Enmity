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
              return <Text style={{ color: 'orange', fontSize: 12 }}> [!] </Text>; 
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
              <View style={{ flexDirection: 'row', marginLeft: 4, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12 }}>{icons.join(" ")}</Text>
              </View>
          );
      };

      // GÜÇLÜ YAMA FONKSİYONU: React.memo() veya objeleri sarmalamak için
      const patchReactComponent = (module: any, propName: string, patchCallback: any) => {
          if (!module || !module[propName]) return;
          const component = module[propName];
          
          if (typeof component === "function") {
              Patcher.after(module, propName, patchCallback);
          } else if (typeof component === "object") {
              if (typeof component.type === "function") {
                  Patcher.after(component, "type", patchCallback);
              } else if (typeof component.render === "function") {
                  Patcher.after(component, "render", patchCallback);
              } else if (typeof component.default === "function") {
                  Patcher.after(component, "default", patchCallback);
              }
          }
      };

      // 1. Üyeler Listesi (GuildMemberRow)
      const GuildMemberModule = getByProps("GuildMemberRow");
      if (GuildMemberModule) {
          patchReactComponent(GuildMemberModule, "GuildMemberRow", (self: any, args: any, res: any) => {
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

      // 2. Kullanıcı Satırı (UserRow)
      const UserRowModule = getByProps("UserRow");
      if (UserRowModule) {
          patchReactComponent(UserRowModule, "UserRow", (self: any, args: any, res: any) => {
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

      // 3. Sohbet Mesajı İsimleri (MessageHeader / MessageTimestamp)
      const MessageHeader = getByProps("MessageTimestamp");
      if (MessageHeader) {
          patchReactComponent(MessageHeader, "default", (self: any, args: any, res: any) => {
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
      if (DisplayName) {
          patchReactComponent(DisplayName, "default", (self: any, args: any, res: any) => {
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
