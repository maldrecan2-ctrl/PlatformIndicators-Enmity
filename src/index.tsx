import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps, getByDisplayName } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import { getIDByName } from 'enmity/api/assets';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // EN BÜYÜK SORUN ÇÖZÜLDÜ: React komponentleri "getByName" ile bulunamıyor çünkü
      // Discord uygulaması küçültülmüş (minified) olduğu için "name" özellikleri siliniyor.
      // Bunny eklentilerinin asıl taktiği olan "getByDisplayName" metodunu kullanmak gerekiyormuş!
      
      const SessionStore = getByProps("getSessions", "getSession");
      const UserStore = getByProps("getUser", "getCurrentUser");
      const { View, Image } = getByProps("View", "Image") || {};
      
      if (!SessionStore || !UserStore || !View || !Image) return;

      // BUNNY EKLENTİSİNDEKİ ORİJİNAL LOGO İSİMLERİ (Nokta atışı varlık ID'leri)
      const nativeIcons = {
          desktop: getIDByName("ic_desktop"),
          mobile: getIDByName("ic_mobile_device"),
          web: getIDByName("ic_web"),
          embedded: getIDByName("ic_console"),
          vr: getIDByName("ic_vr")
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
                  if (client && nativeIcons[client as keyof typeof nativeIcons]) {
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
                                  style={{ width: 14, height: 14, marginLeft: 2, tintColor: (colors as any)[c.status] || colors.online }} 
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

      const patchComponent = (displayName: string) => {
          const Module = getByDisplayName(displayName);
          if (!Module) return;
          
          Patcher.after(Module, "default", (self, args, res) => {
              try {
                  const user = args[0]?.user || args[0]?.message?.author;
                  const currentUser = UserStore.getCurrentUser();
                  if (user && currentUser && user.id === currentUser.id) {
                      const iconElements = getMyPlatformIcons();
                      if (iconElements) {
                          if (findInReactTree(res, n => n?.key === "MyPlatformIcons")) return res;

                          const targetView = findInReactTree(res, n => n?.props?.style?.flexDirection === "row" || n?.type?.displayName === "MessageUsername");
                          
                          if (targetView && Array.isArray(targetView.props.children)) {
                              targetView.props.children.push(
                                  <View key="MyPlatformIcons" style={{ flexDirection: "row", alignItems: "center" }}>
                                      {iconElements}
                                  </View>
                              );
                          } else if (res && res.props && Array.isArray(res.props.children)) {
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

      // BUNNY TAKTİĞİ: "name" yerine "displayName" ile arama yapıyoruz.
      patchComponent("ProfileHeader");
      patchComponent("MemberListItem");
      patchComponent("ChatProfile");
      patchComponent("MessageHeader");

   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
