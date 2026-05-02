import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');
const { View, Text } = getByProps("View", "Text") || {};

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
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

      const findByTypeNameAll = (name: string) => {
          const results = [];
          for (const m of getModules()) {
              if (m && m.default && m.default.type && m.default.type.name === name) results.push(m.default);
              else if (m && m.type && m.type.name === name) results.push(m);
          }
          return results;
      };

      const findInReactTree = (tree: any, filter: (node: any) => boolean): any => {
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
      };

      // GECİKMELİ (LAZY) YÜKLEME - HATA BURADAYDI! 
      // Uygulama açılırken anında arayınca bulamıyordu. O yüzden fonksiyon içine aldık.
      const getStore = (name: string) => {
          try {
              const modules = (window as any).enmity?.metro?.getModules?.() || [];
              for (const m of modules) {
                  if (m && m.default && typeof m.default.getName === "function" && m.default.getName() === name) return m.default;
                  if (m && typeof m.getName === "function" && m.getName() === name) return m;
              }
          } catch(e) {}
          return null;
      };

      const getPlatformString = (userId: string) => {
          const PresenceStore = getStore("PresenceStore") || getByProps("getState", "getPresence");
          const UserStore = getStore("UserStore") || getByProps("getCurrentUser");
          const SessionStore = getStore("SessionsStore") || getByProps("getSessions");

          if (!PresenceStore || !UserStore) return null;
          
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
                  statuses = PresenceStore.getState()?.clientStatuses?.[userId];
              }
          } catch(e) {}
          
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

          return " " + icons.join(" ");
      };

      const StatusModule = findByName("Status");
      if (StatusModule) {
          Patcher.before(StatusModule, "default", (self, args) => {
              if (args && args[0]) {
                  args[0].isMobileOnline = false;
              }
          });
      }

      const DisplayNameModule = findByName("DisplayName");
      if (DisplayNameModule) {
          Patcher.after(DisplayNameModule, "default", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  if (user && user.id) {
                      const icons = getPlatformString(user.id);
                      if (icons) {
                          // Daha güvenli yerleştirme
                          if (res && res.props) {
                              res.props.children = (
                                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                                      {res.props.children}
                                      <Text style={{ fontSize: 13, marginLeft: 2 }}>{icons}</Text>
                                  </View>
                              );
                          }
                      }
                  }
              } catch(e) {}
              return res;
          });
      }

      const GuildMemberRowModule = getByProps("GuildMemberRow");
      if (GuildMemberRowModule && GuildMemberRowModule.GuildMemberRow) {
          if (typeof GuildMemberRowModule.GuildMemberRow === "object" && GuildMemberRowModule.GuildMemberRow.type) {
              Patcher.after(GuildMemberRowModule.GuildMemberRow, "type", (self, args, res) => {
                  try {
                      const user = args[0]?.user;
                      if (!user) return res;
                      const icons = getPlatformString(user.id);
                      if (!icons) return res;

                      if (findInReactTree(res, n => n.key === "GuildMemberRowStatusIconsView")) return res;

                      const targetView = findInReactTree(res, n => n?.props?.style?.flexDirection === "row");
                      if (targetView && Array.isArray(targetView.props.children)) {
                          targetView.props.children.splice(2, 0, (
                              <View key="GuildMemberRowStatusIconsView" style={{ flexDirection: "row", alignItems: "center" }}>
                                  <Text style={{ fontSize: 13 }}>{icons}</Text>
                              </View>
                          ));
                      } else if (res && res.props) {
                          // Güvenli yedek yama
                          res.props.children = (
                              <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                  <View style={{ flex: 1 }}>{res.props.children}</View>
                                  <Text style={{ fontSize: 13 }}>{icons}</Text>
                              </View>
                          );
                      }
                  } catch(e) {}
                  return res;
              });
          }
      }

      const userRows = findByTypeNameAll("UserRow");
      userRows.forEach(UserRowComp => {
          if (typeof UserRowComp === "object" && UserRowComp.type) {
              Patcher.after(UserRowComp, "type", (self, args, res) => {
                  try {
                      const user = args[0]?.user;
                      if (!user) return res;
                      const icons = getPlatformString(user.id);
                      if (!icons) return res;

                      if (findInReactTree(res, n => n.key === "TabsV2MemberListStatusIconsView")) return res;

                      if (res && res.props && res.props.label) {
                          const oldLabel = res.props.label;
                          res.props.label = (
                              <View style={{ flex: 1, justifyContent: "space-between", flexDirection: "row", alignItems: "center" }} key="TabsV2MemberListStatusIconsView">
                                  {oldLabel}
                                  <View key="TabsV2MemberListStatusIconsInner" style={{ flexDirection: "row", marginLeft: 4, alignItems: "center" }}>
                                      <Text style={{ fontSize: 13 }}>{icons}</Text>
                                  </View>
                              </View>
                          );
                      }
                  } catch(e) {}
                  return res;
              });
          }
      });

   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
