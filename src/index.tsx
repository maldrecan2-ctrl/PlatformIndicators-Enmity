import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const paths = {
    desktop: "M4 2.5c-1.103 0-2 .897-2 2v11c0 1.104.897 2 2 2h7v2H7v2h10v-2h-4v-2h7c1.103 0 2-.896 2-2v-11c0-1.103-.897-2-2-2H4Zm16 2v9H4v-9h16Z",
    web: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z",
    mobile: "M15.5 1h-8A2.5 2.5 0 0 0 5 3.5v17A2.5 2.5 0 0 0 7.5 23h8a2.5 2.5 0 0 0 2.5-2.5v-17A2.5 2.5 0 0 0 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z",
    embedded: "M5.79335761,5 L18.2066424,5 C19.7805584,5 21.0868816,6.21634264 21.1990185,7.78625885 L21.8575059,17.0050826 C21.9307825,18.0309548 21.1585512,18.9219909 20.132679,18.9952675 C20.088523,18.9984215 20.0442685,19 20,19 C18.8245863,19 17.8000084,18.2000338 17.5149287,17.059715 L17,15 L7,15 L6.48507125,17.059715 C6.19999155,18.2000338 5.1754137,19 4,19 C2.97151413,19 2.13776159,18.1662475 2.13776159,17.1377616 C2.13776159,17.0934931 2.1393401,17.0492386 2.1424941,17.0050826 L2.80098151,7.78625885 C2.91311838,6.21634264 4.21944161,5 5.79335761,5 Z M14.5,10 C15.3284271,10 16,9.32842712 16,8.5 C16,7.67157288 15.3284271,7 14.5,7 C13.6715729,7 13,7.67157288 13,8.5 C13,9.32842712 13.6715729,10 14.5,10 Z M18.5,13 C19.3284271,13 20,12.3284271 20,11.5 C20,10.6715729 19.3284271,10 18.5,10 C17.6715729,10 17,10.6715729 17,11.5 C17,12.3284271 17.6715729,13 18.5,13 Z M6,9 L4,9 L4,11 L6,11 L6,13 L8,13 L8,11 L10,11 L10,9 L8,9 L8,7 L6,7 L6,9 Z",
    vr: "M12,2C6.47,2,2,6.47,2,12s4.47,10,10,10s10-4.47,10-10S17.53,2,12,2z M17,14h-3c-0.55,0-1,0.45-1,1s0.45,1,1,1h3c0.55,0,1-0.45,1-1S17.55,14,17,14z M10,14H7c-0.55,0-1,0.45-1,1s0.45,1,1,1h3c0.55,0,1-0.45,1-1S10.55,14,10,14z M20,12c0,4.41-3.59,8-8,8s-8-3.59-8-8s3.59-8,8-8S20,7.59,20,12z"
};

const colors = {
    online: "#23a55a",
    dnd: "#f23f43",
    idle: "#f0b232",
    offline: "#80848e"
};

// Yedek Resim URL'leri (Orijinal logolara en yakın şeffaf ikonlar)
const fallbackImages = {
    desktop: "https://img.icons8.com/ios-filled/50/23a55a/mac-client.png",
    mobile: "https://img.icons8.com/ios-filled/50/23a55a/iphone-x.png",
    web: "https://img.icons8.com/ios-filled/50/23a55a/domain.png",
    embedded: "https://img.icons8.com/ios-filled/50/23a55a/game-controller.png",
    vr: "https://img.icons8.com/ios-filled/50/23a55a/virtual-reality.png"
};

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      const SessionStore = getByProps("getSessions", "getSession");
      const UserStore = getByProps("getUser", "getCurrentUser");
      const { View, Image } = getByProps("View", "Image") || {};
      
      if (!SessionStore || !UserStore || !View) return;

      // Svg ve Path modüllerini Discord içinde bulmak
      let Svg: any = null;
      let Path: any = null;
      
      const svgMod1 = getByProps("Svg", "Path");
      if (svgMod1) { Svg = svgMod1.Svg || svgMod1.default; Path = svgMod1.Path; }
      if (!Svg) { const svgMod2 = getByProps("Svg", "Rect"); Svg = svgMod2?.Svg || svgMod2?.default; }
      if (!Path) { const pathMod = getByProps("Path", "Rect"); Path = pathMod?.Path || pathMod?.default; }

      const getMyPlatformIcons = () => {
          try {
              const sessions = SessionStore.getSessions() || {};
              let activeClients: {client: string, status: string}[] = [];
              
              const vals = Object.values(sessions) as any[];
              for (let i = 0; i < vals.length; i++) {
                  const client = vals[i]?.clientInfo?.client;
                  const status = vals[i]?.status || "online";
                  if (client && (client === "desktop" || client === "web" || client === "mobile" || client === "embedded" || client === "vr")) {
                      if (!activeClients.find(c => c.client === client)) {
                          activeClients.push({ client, status });
                      }
                  }
              }
              
              if (activeClients.length === 0) return null;

              // Eğer SVG motoru bozuksa veya Discord izin vermiyorsa, dışarıdan Resim (Image) çek!
              if (!Svg || !Path || !Image) {
                  if (!Image) return null;
                  return (
                      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 4 }}>
                          {activeClients.map((c, i) => (
                              <Image 
                                  key={i} 
                                  source={{ uri: (fallbackImages as any)[c.client] }} 
                                  style={{ width: 14, height: 14, marginLeft: 3, tintColor: (colors as any)[c.status] || colors.online }} 
                              />
                          ))}
                      </View>
                  );
              }

              // SVG modülü varsa %100 orijinal vektörleri çiz
              return (
                  <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 4 }}>
                      {activeClients.map((c, i) => (
                          <Svg key={i} width={14} height={14} viewBox="0 0 24 24" style={{ marginLeft: 3 }}>
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
                              <View key="MyChatProfileIcons" style={{ position: "absolute", top: 10, right: 10 }}>
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
