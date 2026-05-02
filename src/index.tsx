import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // ÇOK BASİT BİR TEST: Acaba Enmity patcher'ımız mı çalışmıyor, yoksa verileri mi çekemiyoruz?
      // Bunu anlamak için Discord'un en temel mesaj gönderme fonksiyonuna müdahale edelim.
      // Eğen bir mesaj gönderdiğinizde sonuna " [TEST]" eklenirse, Patcher çalışıyor demektir.
      
      const MessageActions = getByProps("sendMessage");
      if (MessageActions) {
          Patcher.before(MessageActions, "sendMessage", (self, args) => {
              if (args && args[1] && args[1].content) {
                  args[1].content += " [Cihaz: Mobil 📱]";
              }
          });
      }

      // 2. Bir diğer test: Mesajları gösteren bileşeni zorla basit bir şeye yamamak
      const MessageTimestamp = getByProps("MessageTimestamp");
      if (MessageTimestamp) {
          Patcher.after(MessageTimestamp, "default", (self, args, res) => {
             // Eğer bu çalışırsa, isimlerin yanındaki tarih/saat kısmının yanına emoji eklenmiş olur.
             try {
                 if (res && res.props) {
                     const React = (window as any).enmity?.metro?.common?.React || getByProps("createElement");
                     const { Text } = getByProps("View", "Text") || {};
                     
                     if (React && Text && res.props.children) {
                         res.props.children = React.createElement(Text, null, res.props.children, " 📱");
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
