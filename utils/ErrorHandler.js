/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/MessageBox","sap/m/MessageToast","sap/m/BusyDialog","sap/ui/core/message/Message","sap/m/MessagePopover","sap/m/MessagePopoverItem"],function(M,T,B,a,b,c){"use strict";var _=null;var h={getMessageManager:function(){return sap.ui.getCore().getMessageManager();},createMessagePopover:function(){return new b({items:{path:"/",template:new c({title:"{message}",description:"{description}",type:"{type}"})}});},showBusy:function(t){_=new B({title:t});_.open();},hideBusy:function(){if(_){_.close();}},showError:function(e){M.error(e);},showToast:function(m){T.show(m,{duration:3000});},numOfErrors:function(m){var o=m||this.getMessageManager();var d=o.getMessageModel().getData();return d.filter(function(e){return e.type==="Error";}).length;},numOfMessages:function(m){var o=m||this.getMessageManager();var d=o.getMessageModel().getData();return d.length;},handleError:function(E){jQuery.sap.log.error(E);var m="";try{var d=JSON.parse(E.response.body);m=d.error.message;}catch(e){m=E.message;}this.showError(m);},setErrorMessages:function(m,d,o){var e=d.map(function(i){if(typeof i.processor==="undefined"){i.processor=o;}return new a(i);});m.addMessages(e);},removeMessagesByPath:function(p,m){var o=m||this.getMessageManager();var P=p.split("/");var d=o.getMessageModel().getData();d.forEach(function(i){var t=i.target.split("/");var r=P.every(function(k,I){if(t[I]!==k){return false;}return true;});if(r){o.removeMessages(i);}});},removeMessagesByPartialPath:function(p,m){var o=m||this.getMessageManager();var d=o.getMessageModel().getData();d.forEach(function(e){if(e.target.indexOf(p)>-1){o.removeMessages(e);}});},getFirstMessage:function(m){var o=m||this.getMessageManager();var d=o.getMessageModel().getData();if(d&&d.length>0){return d[0];}},errorExistByPartialPath:function(p,m){var o=m||this.getMessageManager();var d=o.getMessageModel().getData();var e=false;d.forEach(function(f){if(f.type==="Error"&&f.target.indexOf(p)>-1){e=true;}});return e;},};return h;},true);
