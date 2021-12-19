/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["jquery.sap.global","sap/ui/core/mvc/Controller","sap/ui/model/json/JSONModel","retail/pmr/promotionaloffers/utils/Models","retail/pmr/promotionaloffers/utils/Utils","retail/pmr/promotionaloffers/utils/Constants","sap/ui/core/message/Message"],function(q,C,J,M,U,b,c){"use strict";var d=function(a,p){return a[p]&&!!a[p].trim();};var g=function(i,p){return"/Attributes/"+i+p;};var f=function(a){return a.some(function(h,i){return(a.indexOf(h,i+1)>-1);});};function e(E){return E.getSource().getParent().getBindingContext().getPath().split("/")[2];}function u(I){var a=[],l=I.length;for(var i=0;i<l;i++){for(var j=i+1;j<l;j++){if(I[i].AttributeType===I[j].AttributeType){j=++i;}}a.push(I[i]);}return a;}return C.extend("retail.pmr.promotionaloffers.plugins.Attributes",{onInit:function(){this.contentModel=new J();this.oModel=new J({Attributes:[]});this.oMessageManager=U.getMessageManager();this.oBus=sap.ui.getCore().getEventBus();this.oAttributeValues={};this.i18nModel=U.getI18NModel();this.getView().setModel(this.i18nModel,"i18n");this.getView().setModel(this.contentModel,"Content");this.getView().setModel(this.oModel);},openAttributeImageDialog:function(E){if(!this._valueHelpDialog){this._valueHelpDialog=sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.AttributeImageDialog",this);this._valueHelpDialog.setModel(this.i18nModel,"i18n");this._valueHelpDialog.setModel(M.getServiceModel());this.getView().addDependent(this._valueHelpDialog);this.oImagesTable=sap.ui.getCore().byId("imagesTable");}this.indexRow=e(E);this._valueHelpDialog.open();},closeAttributeImageDialog:function(){this._valueHelpDialog.close();},selectRow:function(E){var s=E.getParameter("listItem");var B=s.getBindingContext();var p=B.getPath();var a=B.oModel.getProperty(p);this.oImagesTable.removeSelections();this.oModel.setProperty("/Attributes/"+this.indexRow+"/AttributeImageUrl",a.Url);this.oModel.setProperty("/Attributes/"+this.indexRow+"/AttributeImageName",a.Name);this.oModel.setProperty("/Attributes/"+this.indexRow+"/AttributeValue",U.base64ToHex(a.Id));this._valueHelpDialog.close();},handleImageChangePress:function(E){this.indexRow=e(E);this.oModel.setProperty("/Attributes/"+this.indexRow+"/AttributeValue","");this.validateForm();},setAttributeStructure:function(s){var a=this.aTypeDesc;this.oAttributeStructure=s.AttributeSet.reduce(function(r,h){if(!r[h.AttributeType]){r[h.AttributeType]={AttributeTypes:a,AttributeTypeDescriptions:[],AttributeTypeSelKey:h.AttributeType,AttributeTypeDescSelKey:"",AttributeValue:"",AttributeLanguageSelKey:"",AttributeLanguageSet:h.AttributeType==="01"||h.AttributeType==="02"?s.LanguageSet:[]};}r[h.AttributeType].AttributeTypeDescriptions.push({AttributeId:h.AttributeId,AttributeDesc:h.AttributeDesc});return r;},{});this.oAttributeStructure[""]={AttributeTypes:a,AttributeTypeDescriptions:[],AttributeTypeSelKey:"",AttributeTypeDescSelKey:"",AttributeValue:"",AttributeLanguageSelKey:"",AttributeLanguageSet:[]};},handleAddPress:function(){var a=Object.keys(this.oAttributeStructure).shift()||"";var s=this.oAttributeStructure[a];var n=q.extend(true,{},s,{AttributeTypeDescSelKey:(s.AttributeTypeDescriptions[0]||{}).AttributeId,AttributeLanguageSelKey:s.AttributeLanguageSet.length?"EN":""});this.oModel.getData().Attributes.push(n);this.oModel.updateBindings();this.setListAttributeValues(this.oModel.getData().Attributes.length-1);},handleDeletePress:function(E){var a=this.oModel.getProperty("/Attributes");var p=E.getParameter("listItem").getBindingContext().getPath();var t=p.split("/");var r=t[t.length-1];a.splice(r,1);U.removeMessagesByPath("/Attributes");this.oModel.updateBindings();},handleAttrTypeChange:function(E){var s=e(E);var a=E.getSource().getSelectedKey();var h=this.oAttributeStructure[a];if(a){var i=q.extend({},h,{AttributeTypeDescSelKey:h.AttributeTypeDescriptions[0].AttributeId,AttributeLanguageSelKey:h.AttributeLanguageSet.length?"EN":"",AttributeValue:""});this.oModel.setProperty("/Attributes/"+s,i);this.setListAttributeValues(s).then(function(){this.oModel.updateBindings(true);}.bind(this));}else{this.oModel.setProperty("/Attributes/"+s,h);}},setListAttributeValues:function(i){var a=this.oModel.getProperty("/Attributes/"+i);var k=a.AttributeTypeDescSelKey;var v=a.AttributeValue;if(a.AttributeTypeSelKey!==b.ATTRIBUTE_CONST_TYPE.list||!k){return Promise.resolve(v);}var h="/Attributes/"+i;if(!this.oAttributeValues[k]){this.oModel.setProperty(h+"/BusyList",true);return M.getAttributeValues(k).then(function(r){this.oAttributeValues[k]=r.data;this.oModel.setProperty(h+"/attributeValueList",this.oAttributeValues[k]);this.oModel.setProperty(h+"/AttributeValue",r.data[0].Value);this.oModel.setProperty(h+"/BusyList",false);return v;}.bind(this));}else{this.oModel.setProperty(h+"/attributeValueList",this.oAttributeValues[k]);this.oModel.setProperty(h+"/AttributeValue",this.oAttributeValues[k][0].Value);return Promise.resolve(v);}},handleTypeDescriptionChange:function(E){var s=e(E);var k=E.getSource().getSelectedKey();var a="/Attributes/"+s;this.oModel.setProperty(a+"/attributeTypeDescriptionSelectedType",k);this.oModel.setProperty(a+"/attributeValueListSelectedKey","");if(b.ATTRIBUTE_CONST_TYPE.list===this.oModel.getProperty(a+"/AttributeTypeSelKey")){this.setListAttributeValues(s);}},validateForm:function(){var a=this.oModel.getProperty("/Attributes");var h=[];var j=[];var k=false;U.removeMessagesByPath("/Attributes");for(var i=0;i<a.length;i++){k=false;var l=(a[i].AttributeLanguageSet.length)?a[i].AttributeLanguageSelKey:"";var m={"AttributeType":a[i].AttributeTypeSelKey,"Attribute":a[i].AttributeTypeDescSelKey,"Value":a[i].AttributeValue,"Language":a[i].AttributeLanguageSelKey,"ComparisonString":a[i].AttributeTypeSelKey+a[i].AttributeTypeDescSelKey+l};if(!d(a[i],"AttributeTypeSelKey")){k=true;j.push(new c({message:this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Type"),description:this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeTypeRow",i+1),type:"Error",target:g(i,"/AttributeTypeSelKey"),processor:this.oModel}));}if(!d(a[i],"AttributeTypeDescSelKey")){k=true;j.push(new c({message:this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Name"),description:this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeNameRow",i+1),type:"Error",target:g(i,"/AttributeTypeDescSelKey"),processor:this.oModel}));}if(!d(a[i],"AttributeValue")&&m.AttributeType!==b.ATTRIBUTE_CONST_TYPE.tag){k=true;j.push(new c({message:this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Value"),description:this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeValueRow",i+1),type:"Error",target:g(i,"/AttributeValue"),processor:this.oModel}));}if(!d(a[i],"AttributeLanguageSelKey")&&m.AttributeType===b.ATTRIBUTE_CONST_TYPE.text){k=true;j.push(new c({message:this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Language"),description:this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeLanguageRow",i+1),type:"Error",target:g(i,"/AttributeLanguageSelKey"),processor:this.oModel}));}if(!k){h.push(m.ComparisonString);}}if(f(h)){j.push(new c({message:this.i18nModel.getResourceBundle().getText("Attributes.Must.Be.Unique"),description:this.i18nModel.getResourceBundle().getText("Attributes.Cannot.HaveSame.Attribute.Description"),type:"Error",target:"/Attributes",processor:this.oModel}));}this.oMessageManager.addMessages(j);return j.length;},setOfferData:function(a,s){this.aTypeDesc=u(s.AttributeSet||[]);this.contentModel.setProperty("/Editable",!a.Readonly);this.setAttributeStructure(s);var h=(a.Attributes||[]).map(function(i){return q.extend({},this.oAttributeStructure[i.AttributeType],{AttributeTypeDescSelKey:i.Attribute,AttributeValue:i.Value,AttributeLanguageSelKey:i.Language});}.bind(this));this.oModel.setData({Attributes:h});this.oModel.getProperty("/Attributes").forEach(function(v,i){if(v.AttributeTypeSelKey===b.ATTRIBUTE_CONST_TYPE.list){this.setListAttributeValues(i).then(function(k){this.oModel.setProperty("/Attributes/"+i+"/AttributeValue",k);}.bind(this));}else if(v.AttributeTypeSelKey===b.ATTRIBUTE_CONST_TYPE.image){M.getImageInformation(v.AttributeValue).then(function(D){this.oModel.setProperty("/Attributes/"+i+"/AttributeImageUrl",D.Url);}.bind(this));}}.bind(this));this.oModel.updateBindings(true);},getOfferData:function(){var i=this.oModel.getProperty("/Attributes")||[];var a=i.map(function(I){return{"AttributeType":I.AttributeTypeSelKey,"Attribute":I.AttributeTypeDescSelKey,"Value":I.AttributeValue,"Language":I.AttributeLanguageSelKey};});return{Attributes:a};},processServerErrors:function(m){U.setErrorMessages(this.oMessageManager,m,this.oModel);U.removeMessagesByPath("/Attributes");},resetAttributes:function(){this.oModel.setProperty("/",[]);}});});