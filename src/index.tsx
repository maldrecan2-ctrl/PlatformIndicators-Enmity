import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const paths = {
    desktop: "M4 2.5c-1.103 0-2 .897-2 2v11c0 1.104.897 2 2 2h7v2H7v2h10v-2h-4v-2h7c1.103 0 2-.896 2-2v-11c0-1.103-.897-2-2-2H4Zm16 2v9H4v-9h16Z",
    web: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z",
    mobile: "M15.5 1h-8A2.5 2.5 0 0 0 5 3.5v17A2.5 2.5 0 0 0 7.5 23h8a2.5 2.5 0 0 0 2.5-2.5v-17A2.5 2.5 0 0 0 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z"
};

const colors = {
    online: "#23a55a",
    dnd: "#f23f43",
    idle: "#f0b232",
    offline: "#80848e"
};

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // 1. GEREKSİNİMLERİ GÜVENLİ ARAMA (Çökmemesi için)
      const SessionStore = getByProps("getSessions", "getSession");
      const UserStore = getByProps("getUser", "getCurrentUser");
      const { View, Text } = getByProps("View", "Text") || {};
      
      if (!SessionStore || !UserStore || !View || !Text) return;

      // Svg ve Path modüllerini Discord içinde bulmak için alternatif yollar
      let Svg: any = null;
      let Path: any = null;
      
      const svgMod1 = getByProps("Svg", "Path");
      if (svgMod1) { Svg = svgMod1.Svg || svgMod1.default; Path = svgMod1.Path; }
      
      if (!Svg) {
          const svgMod2 = getByProps("Svg", "Rect");
          Svg = svgMod2?.Svg || svgMod2?.default;
      }
      if (!Path) {
          const pathMod = getByProps("Path", "Rect");
          Path = pathMod?.Path || pathMod?.default;
      }

      const getMyPlatformIcons = () => {
          try {
              const sessions = SessionStore.getSessions() || {};
              let activeClients: {client: string, status: string}[] = [];
              
              const vals = Object.values(sessions) as any[];
              for (let i = 0; i < vals.length; i++) {
                  const client = vals[i]?.clientInfo?.client;
                  const status = vals[i]?.status || "online";
                  if (client && (client === "desktop" || client === "web" || client === "mobile")) {
                      if (!activeClients.find(c => c.client === client)) {
                          activeClients.push({ client, status });
                      }
                  }
              }
              
              if (activeClients.length === 0) return null;

              // Eğer SVG modülünü bulamazsak HATA VERMESİN DİYE normal emojiye dön (Hata tespiti için)
              if (!Svg || !Path) {
                  let fallbackStr = "";
                  activeClients.forEach(c => {
                      if (c.client === "mobile") fallbackStr += String.fromCodePoint(0x1F4F1);
                      if (c.client === "desktop") fallbackStr += String.fromCodePoint(0x1F4BB);
                      if (c.client === "web") fallbackStr += String.fromCodePoint(0x1F310);
                  });
                  return (
                      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 4 }}>
                          <Text style={{ fontSize: 14 }}>{fallbackStr}</Text>
                      </View>
                  );
              }

              // SVG modülü varsa orijinal vektörleri çiz
              return (
                  <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 4 }}>
                      {activeClients.map((c, i) => (
                          <Svg key={i} width={16} height={16} viewBox="0 0 24 24" style={{ marginLeft: 3 }}>
                              <Path d={(paths as any)[c.client]} fill={(colors as any)[c.status] || colors.online} />
                          </Svg>
                      ))}
                  </View>
              );
          } catch(e) {}
          return null;
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

      // 1. PROFİL SAYFASI İSİM (DisplayName) YAMASI
      const DisplayNameModule = getByProps("DisplayName");
      if (DisplayNameModule) {
          const target = typeof DisplayNameModule === "function" ? DisplayNameModule : (DisplayNameModule.default || DisplayNameModule.DisplayName);
          if (target) {
              Patcher.after(DisplayNameModule, typeof DisplayNameModule === "function" ? "DisplayName" : (DisplayNameModule.default ? "default" : "DisplayName"), (self, args, res) => {
                  try {
                      const user = args[0]?.user;
                      const currentUser = UserStore.getCurrentUser();
                      if (user && currentUser && user.id === currentUser.id) {
                          const iconElements = getMyPlatformIcons();
                          if (iconElements && res && res.props) {
                              res.props.children = (
                                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                                      {res.props.children}
                                      {iconElements}
                                  </View>
                              );
                          }
                      }
                  } catch(e) {}
                  return res;
              });
          }
      }

      // 2. ÜYE LİSTESİ (GuildMemberRow) YAMASI
      const GuildMemberRowModule = getByProps("GuildMemberRow");
      if (GuildMemberRowModule && GuildMemberRowModule.GuildMemberRow) {
          Patcher.after(GuildMemberRowModule.GuildMemberRow, "type", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  const currentUser = UserStore.getCurrentUser();
                  if (user && currentUser && user.id === currentUser.id) {
                      const iconElements = getMyPlatformIcons();
                      if (iconElements) {
                          if (findInReactTree(res, n => n.key === "MyGuildMemberRowIcons")) return res;
                          const targetView = findInReactTree(res, n => n?.props?.style?.flexDirection === "row");
                          if (targetView && Array.isArray(targetView.props.children)) {
                              targetView.props.children.splice(2, 0, (
                                  <View key="MyGuildMemberRowIcons" style={{ flexDirection: "row", alignItems: "center" }}>
                                      {iconElements}
                                  </View>
                              ));
                          }
                      }
                  }
              } catch(e) {}
              return res;
          });
      }
      
      // 3. SOHBET PROFİLİ (Kullanıcı Adına Tıklayınca Açılan Yer)
      const ChatProfile = getByProps("ChatProfile");
      if (ChatProfile && ChatProfile.default) {
          Patcher.after(ChatProfile, "default", (self, args, res) => {
              try {
                  const user = args[0]?.user;
                  const currentUser = UserStore.getCurrentUser();
                  if (user && currentUser && user.id === currentUser.id) {
                      const iconElements = getMyPlatformIcons();
                      if (iconElements && res && res.props && Array.isArray(res.props.children)) {
                          res.props.children.push(
                              <View style={{ position: "absolute", top: 10, right: 10 }}>
                                  {iconElements}
                              </View>
                          );
                      }
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
