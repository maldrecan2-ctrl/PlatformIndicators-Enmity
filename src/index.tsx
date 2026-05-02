import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps, getByName } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import { find } from 'enmity/api/assets';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // NEDEN HİÇBİR ŞEY ÇIKMADI? Çünkü "DisplayName" ve "GuildMemberRow" isimleri Discord'un 
      // eski sürümlerine aitmiş! Bunny (Vendetta) eklentilerinde kullanılan YENİ 261.0 uyumlu 
      // komponent isimlerini (ProfileHeader, MemberListItem) buldum!
      // Ayrıca logoları dışarıdan çekmek yerine ENMITY'NİN KENDİ ASSET SİSTEMİYLE Discord'un 
      // içindeki %100 orijinal, kendi çizdiği Asset logolarını (ic_mobile vb.) kullanıyoruz!

      const SessionStore = getByProps("getSessions", "getSession");
      const UserStore = getByProps("getUser", "getCurrentUser");
      const { View, Image } = getByProps("View", "Image") || {};
      
      if (!SessionStore || !UserStore || !View || !Image) return;

      // DISCORD'UN KENDİ İÇİNDEKİ %100 ORİJİNAL LOGOLARINI ÇEKİYORUZ! (Bunny'nin yaptığı gibi)
      const getAssetSafe = (keywords: string[]) => {
          try {
              return find(a => a && a.name && keywords.some(k => a.name.toLowerCase().includes(k)))?.id;
          } catch(e) { return null; }
      };

      const nativeIcons = {
          desktop: getAssetSafe(["desktop", "window", "computer"]),
          mobile: getAssetSafe(["mobile", "phone", "iphone"]),
          web: getAssetSafe(["globe", "web", "browser"]),
          embedded: getAssetSafe(["console", "gamepad", "xbox"]),
          vr: getAssetSafe(["vr", "headset", "virtual"])
      };

      const colors = {
          online: "#23a55a",
          dnd: "#f23f43",
          idle: "#f0b232",
          offline: "#80848e"
      };

      const getMyPlatformIcons = () => {
          try {
              const sessions = SessionStore.getSessions() || {};
              let activeClients: {client: string, status: string}[] = [];
              
              const vals = Object.values(sessions) as any[];
              for (let i = 0; i < vals.length; i++) {
                  const client = vals[i]?.clientInfo?.client;
                  const status = vals[i]?.status || "online";
                  if (client) {
                      if (!activeClients.find(c => c.client === client)) {
                          activeClients.push({ client, status });
                      }
                  }
              }
              
              if (activeClients.length === 0) return null;

              return (
                  <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 4 }}>
                      {activeClients.map((c, i) => {
                          const assetId = (nativeIcons as any)[c.client];
                          if (!assetId) return null;
                          return (
                              <Image 
                                  key={i} 
                                  source={assetId} 
                                  style={{ width: 16, height: 16, marginLeft: 4, tintColor: (colors as any)[c.status] || colors.online }} 
                              />
                          );
                      })}
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

      const patchComponent = (componentName: string, isDefault: boolean = true) => {
          const Module = getByName(componentName);
          if (!Module) return;
          
          const target = isDefault ? (Module.default || Module) : Module;
          if (typeof target !== "function" && typeof target.type !== "function") return;

          Patcher.after(Module, isDefault ? (Module.default ? "default" : componentName) : "type", (self, args, res) => {
              try {
                  const user = args[0]?.user || args[0]?.message?.author;
                  const currentUser = UserStore.getCurrentUser();
                  if (user && currentUser && user.id === currentUser.id) {
                      const iconElements = getMyPlatformIcons();
                      if (iconElements) {
                          // Eğer daha önce eklendiyse tekrar ekleme
                          if (findInReactTree(res, n => n?.key === "MyPlatformIcons")) return res;

                          // Satır bazlı arama
                          const targetView = findInReactTree(res, n => n?.props?.style?.flexDirection === "row" || n?.type?.displayName === "MessageUsername");
                          
                          if (targetView && Array.isArray(targetView.props.children)) {
                              // Elemanları araya sokuştur
                              targetView.props.children.push(
                                  <View key="MyPlatformIcons" style={{ flexDirection: "row", alignItems: "center" }}>
                                      {iconElements}
                                  </View>
                              );
                          } else if (res && res.props && Array.isArray(res.props.children)) {
                              // Bulamazsak en sona ekle
                              res.props.children.push(
                                  <View key="MyPlatformIcons" style={{ flexDirection: "row", alignItems: "center" }}>
                                      {iconElements}
                                  </View>
                              );
                          }
                      }
                  }
              } catch(e) {}
              return res;
          });
      };

      // YENİ DISCORD 261.0 UYUMLU KOMPONENT İSİMLERİ (Bunny eklentilerinden alındı)
      patchComponent("ProfileHeader");
      patchComponent("MemberListItem");
      patchComponent("ChatProfile");
      patchComponent("MessageHeader");
      
      // Eski isimler (Yedek)
      patchComponent("DisplayName");
      patchComponent("GuildMemberRow", false);

   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
