/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["jquery.sap.global","retail/pmr/promotionaloffers/utils/Models","retail/pmr/promotionaloffers/utils/Utils","sap/ui/model/json/JSONModel","retail/pmr/promotionaloffers/Component"],function(q,M,U,J,C){"use strict";var s=function(a,c){c.forEach(function(b){if(b){var t=b.getContent();for(var i=0,l=t.length;i<l;i++){t[i].setBusy(a);}}});};function O(a){this.state=a;}O.prototype.calculateFinancials=function(f,c){var p=c?c:this.state.getSavePayload();s(true,f);return this.state.calculateFinancials(p).then(function(d){s(false,f);return d;},function(){s(false,f);});};O.prototype.getForecast=function(f){s(true,f);return this.state.calculateForecast(this.state.getSavePayload()).then(function(d){s(false,f);return d;},function(){s(false,f);});};O.prototype.setHeaderFieldsBusyState=function(a,c){s(a,c);};O.prototype.detectCollision=function(){var S=sap.ushell.Container.getService("CrossApplicationNavigation");var c=C.getMetadata().getConfig();var p=c.displayOfferUrl;var t=this;return new Promise(function(r,a){var o=sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.CollisionDetectionDialog",{onCollisionDialogConfirm:function(){o.close();},onAfterClose:function(){r();o.destroy();o=null;},displayCollision:function(e){if(S){var d=e.getSource().getBindingContext().getProperty("OfferId");var H=p+U.base64ToHex(d);var l={target:{shellHash:H}};var h=S.hrefForExternal(l);var v=S.isIntentSupported([h]);v.done(function(R){if(R[h].supported===true){var u=q(location).attr("href").split("#")[0]+h;q.sap.log.info("Opening new window "+u);sap.m.URLHelper.redirect(u,true);}else{q.sap.log.error("Cannot navigate to display offer");}}).fail(function(){q.sap.log.error("Cannot navigate to display offer");});}else{q.sap.log.error("Cross app navigation service is missing");}},onBeforeRebind:function(e){var B=e.getParameter("bindingParams");var d=B.parameters.select;var f=U.getFieldsFromSort(B.sorter);B.parameters.select=U.attachFieldsToQuery(["OfferId","Editable","OfferSetId","PromotionType","MasterdataSystem","PurchasingGroup","PurchasingGroupName","LeadingCategoryName","LeadingCategory"].concat(f),d);var g=[];var j={};if(t.oCollisionsOffers&&t.oCollisionsOffers.length>0){for(var i=0,l=t.oCollisionsOffers.length;i<l;i++){j=new sap.ui.model.Filter({path:"ExtOfferId",operator:"EQ",value1:""+t.oCollisionsOffers[i].ExtOfferId});g.push(j);}}else{j=new sap.ui.model.Filter({path:"ExtOfferId",operator:"EQ",value1:"-1",value2:""});g.push(j);}var k=new sap.ui.model.Filter({filters:g,and:false});B.filters.push(k);}});t.isCollOpen=true;o.setModel(U.getResourceModel(),"i18n");var b=new J({"linkEnabled":false});o.setModel(b,"settings");if(S){var h=S.hrefForExternal({target:{shellHash:p}});var v=S.isIntentSupported([h]);v.done(function(R){if(R[h].supported===true){var m=new J({"linkEnabled":true});o.setModel(m,"settings");}});}r(o);}.bind(this));};O.prototype.populateCollisionDetection=function(c,p,v){return this.state.detectCollisions(p).then(function(d){this.oCollisionsOffers=d.data.filter(function(i){return i.OfferId!==p.OfferId;});c.setModel(M.getServiceModel());v.addDependent(c);c.open();this.isCollOpen=false;return d;}.bind(this),U.handleErrors);};return O;},true);