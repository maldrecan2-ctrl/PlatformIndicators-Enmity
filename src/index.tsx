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
      // 1. Gelişmiş Metro Arayıcıları (Vendetta tarzı)
      const getModules = () => {
          try {
              return (window as any).enmity?.metro?.getModules?.() || [];
          } catch(e) {
              return [];
          }
      };

      const findByName = (name: string) => {
          for (const m of getModules()) {
              if (m && m.default && m.default.name === name) return m;
              if (m && m.name === name) return m;
              if (m && m.default && m.default.displayName === name) return m;
              if (m && m.displayName === name) return m;
          }
          return null;
      };

      const findByTypeName = (name: string) => {
          const results = [];
          for (const m of getModules()) {
              if (m && m.default && m.default.type && m.default.type.name === name) results.push(m);
              else if (m && m.type && m.type.name === name) results.push(m);
          }
          return results;
      };

      const getStore = (name: string) => {
          try {
              return (window as any).enmity?.metro?.getByStoreName?.(name) || null;
          } catch (e) {
              return null;
          }
      };

      const PresenceStore = getStore("PresenceStore") || getByProps("getState", "getPresence");
      const SessionStore = getStore("SessionsStore") || getByProps("getSessions");
      const UserStore = getStore("UserStore") || getByProps("getCurrentUser");

      const getPlatformIcons = (userId: string) => {
          if (!PresenceStore || !UserStore) {
              return <Text style={{ color: 'red', fontSize: 14 }}> [?] </Text>;
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
              return <Text style={{ color: 'orange', fontSize: 14 }}> [!] </Text>; 
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
              <View style={{ flexDirection: 'row', marginLeft: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14 }}>{icons.join(" ")}</Text>
              </View>
          );
      };

      // 2. Çok Daha Kapsamlı Yama Fonksiyonu
      const patchComponent = (module: any, prop: string, callback: any) => {
          if (!module || !module[prop]) return;
          if (typeof module[prop] === "function") {
              Patcher.after(module, prop, callback);
          } else if (typeof module[prop] === "object") {
              if (module[prop].type) Patcher.after(module[prop], "type", callback);
              else if (module[prop].render) Patcher.after(module[prop], "render", callback);
              else Patcher.after(module, prop, callback);
          }
      };

      // Yeni Discord Redesign (Tabs V2) bileşenlerini arama
      
      // A. Kanal İçi İsimler (Chat/Message)
      const MessageTimestamp = getByProps("MessageTimestamp");
      if (MessageTimestamp) patchComponent(MessageTimestamp, "default", patchChat);
      
      const ChatRow = findByName("ChatRow");
      if (ChatRow) patchComponent(ChatRow, "default", patchChat);
      
      function patchChat(self: any, args: any, res: any) {
          try {
              const message = args[0]?.message;
              if (!message || !message.author) return res;
              const icons = getPlatformIcons(message.author.id);
              if (!icons) return res;
              if (res && res.props) {
                  res.props.children = (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {res.props.children}
                          {icons}
                      </View>
                  );
              }
          } catch(e) {}
          return res;
      }

      // B. Üyeler Listesi (MemberListItem / UserRow / GuildMemberRow)
      const memberListModules = [
          getByProps("MemberListItem"),
          getByProps("GuildMemberRow"),
          findByName("UserRow"),
          findByName("MemberListItem"),
          findByName("GuildMemberRow")
      ];
      
      memberListModules.forEach(mod => {
          if (!mod) return;
          const propName = mod.default ? "default" : (mod.MemberListItem ? "MemberListItem" : (mod.GuildMemberRow ? "GuildMemberRow" : (mod.UserRow ? "UserRow" : null)));
          if (propName) {
              patchComponent(mod, propName, (self: any, args: any, res: any) => {
                  try {
                      const user = args[0]?.user;
                      if (!user) return res;
                      const icons = getPlatformIcons(user.id);
                      if (!icons) return res;
                      if (res && res.props) {
                          res.props.children = (
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 4 }}>
                                  <View style={{ flex: 1 }}>{res.props.children}</View>
                                  {icons}
                              </View>
                          );
                      }
                  } catch (e) {}
                  return res;
              });
          }
      });
      
      // TypeName üzerinden arama (Vendetta Stili)
      const userRows = findByTypeName("UserRow");
      userRows.forEach(mod => {
          patchComponent(mod, "default", (self: any, args: any, res: any) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;
                  const icons = getPlatformIcons(user.id);
                  if (!icons) return res;
                  if (res && res.props) {
                      res.props.children = (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 4 }}>
                              <View style={{ flex: 1 }}>{res.props.children}</View>
                              {icons}
                          </View>
                      );
                  }
              } catch (e) {}
              return res;
          });
      });

   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
