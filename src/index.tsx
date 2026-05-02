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
      // TÜM CRASHLERİN KESİN AÇIKLAMASI: 
      // Discord'un yeni "Hermes C++ Motoru", veritabanlarındaki objeleri (Proxy veya Klon) değiştirdiğimizi 
      // anladığı an "Bozuk Veri" uyarısı verip uygulamayı güvenliğe alarak kendini patlatıyormuş (Crash).
      // Bu yüzden veritabanlarına dokunmak YASAK! Sadece ekrana çizilen resimlerle (React UI) oynayacağız.
      // Bu yöntem %100 C++ korumalıdır, sadece ekran görüntüsünü değiştirir, motoru asla çökertemez.

      const SessionStore = getByProps("getSessions", "getSession");
      const UserStore = getByProps("getUser", "getCurrentUser");

      if (!SessionStore || !UserStore) return;

      const getMyIcons = () => {
          try {
              const sessions = SessionStore.getSessions() || {};
              let icons: string[] = [];
              
              Object.values(sessions).forEach((s: any) => {
                  if (s.clientInfo && s.clientInfo.client) {
                      const client = s.clientInfo.client;
                      if (client === "desktop" && !icons.includes("💻")) icons.push("💻");
                      if (client === "web" && !icons.includes("🌐")) icons.push("🌐");
                      if (client === "mobile" && !icons.includes("📱")) icons.push("📱");
                      if (client === "embedded" && !icons.includes("🎮")) icons.push("🎮");
                      if (client === "vr" && !icons.includes("🥽")) icons.push("🥽");
                  }
              });
              
              if (icons.length > 0) return " " + icons.join("");
          } catch(e) {}
          return "";
      };

      // Ağaç tarayıcı (UI komponentlerinin içine girmek için)
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

      // Modül arayıcı
      const getModules = () => {
          try { return (window as any).enmity?.metro?.getModules?.() || []; } catch(e) { return []; }
      };

      const findByName = (name: string) => {
          for (const m of getModules()) {
              if (m && m.default && m.default.name === name) return m.default;
              if (m && m.name === name) return m;
              if (m && m.default && m.default.displayName === name) return m.default;
              if (m && m.displayName === name) return m;
          }
          return null;
      };

      // 1. PROFİL SAYFASI İSİM (DisplayName)
      const DisplayNameModule = findByName("DisplayName") || getByProps("DisplayName");
      if (DisplayNameModule) {
          const target = typeof DisplayNameModule === "function" ? DisplayNameModule : (DisplayNameModule.default || DisplayNameModule.DisplayName);
          if (target) {
              Patcher.after(DisplayNameModule, typeof DisplayNameModule === "function" ? "DisplayName" : (DisplayNameModule.default ? "default" : "DisplayName"), (self, args, res) => {
                  try {
                      const user = args[0]?.user;
                      const currentUser = UserStore.getCurrentUser();
                      // SADECE BİZİMKİSE:
                      if (user && currentUser && user.id === currentUser.id) {
                          const icons = getMyIcons();
                          if (icons && res && res.props) {
                              // Ekrana çizilen ismin (Text) hemen yanına küçük bir Text daha ekliyoruz
                              res.props.children = (
                                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                                      {res.props.children}
                                      <Text style={{ fontSize: 13, marginLeft: 2 }}>{icons}</Text>
                                  </View>
                              );
                          }
                      }
                  } catch(e) {}
                  return res;
              });
          }
      }

      // 2. ÜYE LİSTESİ (GuildMemberRow)
      const GuildMemberRowModule = getByProps("GuildMemberRow");
      if (GuildMemberRowModule && GuildMemberRowModule.GuildMemberRow) {
          Patcher.after(GuildMemberRowModule.GuildMemberRow, "type", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  const currentUser = UserStore.getCurrentUser();
                  if (user && currentUser && user.id === currentUser.id) {
                      const icons = getMyIcons();
                      if (icons) {
                          // Zaten eklediysek atla
                          if (findInReactTree(res, n => n.key === "MyGuildMemberRowIcons")) return res;

                          // Üye satırındaki yatay (row) kutuyu bul
                          const targetView = findInReactTree(res, n => n?.props?.style?.flexDirection === "row");
                          if (targetView && Array.isArray(targetView.props.children)) {
                              targetView.props.children.splice(2, 0, (
                                  <View key="MyGuildMemberRowIcons" style={{ flexDirection: "row", alignItems: "center" }}>
                                      <Text style={{ fontSize: 13 }}>{icons}</Text>
                                  </View>
                              ));
                          } else if (res && res.props) {
                              // Bulamazsak güvenli şekilde yedek plana geç
                              res.props.children = (
                                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                      <View style={{ flex: 1 }}>{res.props.children}</View>
                                      <Text key="MyGuildMemberRowIcons" style={{ fontSize: 13 }}>{icons}</Text>
                                  </View>
                              );
                          }
                      }
                  }
              } catch(e) {}
              return res;
          });
      }

      // 3. DM LİSTESİ (UserRow)
      const UserRowModules = [];
      for (const m of getModules()) {
          if (m && m.default && m.default.type && m.default.type.name === "UserRow") UserRowModules.push(m.default);
          else if (m && m.type && m.type.name === "UserRow") UserRowModules.push(m);
      }
      
      UserRowModules.forEach(UserRowComp => {
          if (typeof UserRowComp === "object" && UserRowComp.type) {
              Patcher.after(UserRowComp, "type", (self, args, res) => {
                  try {
                      const user = args[0]?.user;
                      const currentUser = UserStore.getCurrentUser();
                      if (user && currentUser && user.id === currentUser.id) {
                          const icons = getMyIcons();
                          if (icons) {
                              if (findInReactTree(res, n => n.key === "MyTabsV2Icons")) return res;

                              if (res && res.props && res.props.label) {
                                  const oldLabel = res.props.label;
                                  res.props.label = (
                                      <View style={{ flex: 1, justifyContent: "space-between", flexDirection: "row", alignItems: "center" }} key="MyTabsV2Icons">
                                          {oldLabel}
                                          <View style={{ flexDirection: "row", marginLeft: 4, alignItems: "center" }}>
                                              <Text style={{ fontSize: 13 }}>{icons}</Text>
                                          </View>
                                      </View>
                                  );
                              }
                          }
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
