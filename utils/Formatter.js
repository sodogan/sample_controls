/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils","retail/pmr/promotionaloffers/utils/Models"],function(U,M){"use strict";var _=sap.ui.core.format.DateFormat.getDateTimeInstance({style:"short"});var a=sap.ui.core.format.DateFormat.getDateInstance({style:"medium",UTC:true});var F={isText:true,isImage:false,isDate:false,dateFormat:function(v){return v?retail.pmr.promotionaloffers.utils.Utils.dateMedium(v):null;},_resetFields:function(){this.isText=false;this.isImage=false;this.isDate=false;},setText:function(v){this._resetFields();this.isText=v;},setImage:function(v){this._resetFields();this.isImage=v;},setDate:function(v){this._resetFields();this.isDate=v;},editableAttribute:function(f){if(f!=="X"){return true;}return false;},attributeTypeImage:function(f){if(f==="Image"){return true;}return false;},attributeTypeInput:function(f){if(f==="Input"){return true;}return false;},attributeTypeText:function(f){if(f==="Text"){return true;}return false;},attributeTypeDate:function(f){if(f==="Date"){return true;}return false;},dateTimeShortFormatter:function(t){if(t){return _.format(t);}else{return"";}},salesProfitFormat:function(p,c){return p+" "+c;},percentFormat:function(m){return m+"%";},datesFormatterForManageOffer:function(f,t){var o=U.getFormatedDateForRead(f);var T=U.getFormatedDateForRead(t);return retail.pmr.promotionaloffers.utils.Utils.getDateRange(o,T);},datesShortFormatter:function(f,t){return retail.pmr.promotionaloffers.utils.Utils.getDateRange(f,t);},lastChangedByFormatter:function(c,C){return c+"\n"+retail.pmr.promotionaloffers.utils.Utils.dateMedium(C);},locationPickerHideIfEmpty:function(f,s,t,v,n,i){var p=f||"";var b=s||"";var c=n||"";var d=v||"";var e=U.getResourceModel().getResourceBundle().getText("Locations.Closed.Store.Short");var g=function(j){return i?j+"["+e+"]":j;};if(t){return g(d||t);}var h=p||b;if(c&&h){return g(d||(c+" ("+h+")"));}else{return g(d||p||b);}},numberOfProductRows:function(p){if(p&&p>1){return 10;}return 1;},formatBlockDate:function(f,s){if(!f&&s){return"-"+retail.pmr.promotionaloffers.utils.Formatter.utcDate(s);}else if(f&&!s){return retail.pmr.promotionaloffers.utils.Formatter.utcDate(f)+"-";}else if(!f&&!s){return"";}return retail.pmr.promotionaloffers.utils.Formatter.utcDate(f)+" - "+retail.pmr.promotionaloffers.utils.Formatter.utcDate(s);},formatDescripTionIdType:function(f,s){if(!f&&s){return s;}else if(f&&!s){return f;}else if(!f&&!s){return"";}return f+" ("+s+")";},summaryLine:function(l,d,w){return l+" "+d+" ("+w+")";},positiveNegativeNumberformat:function(n){if(n>0){return"Success";}else if(n<0){return"Error";}},marginColorformat:function(n){if(n>0){return sap.m.ValueColor.Good;}else if(n<0){return sap.m.ValueColor.Critical;}},marginIndicatorformat:function(n){if(n>0){return sap.m.DeviationIndicator.Up;}else if(n<0){return sap.m.DeviationIndicator.Down;}else{return sap.m.DeviationIndicator.None;}},locationFormat:function(p){return p;},isCalculateVisible:function(e,f){if(e&&f==="X"){return true;}else{return false;}},colorFormatter:function(e){if(e){return"sapThemeCriticalText";}return"sapThemeDarkText";},breadCrumbFormatter:function(c){var t="";if(c&&c.length>0&&c.length>200){t=c.substring(0,197)+"...";}else{t=c;}return t;},utcDate:function(v){var d=new Date(v);return a.format(d);},mergeWithComma:function(v,b){if(v&&b){return v+", "+b;}else{var c=v?v:"";var d=b?b:"";return c+d;}},showParentNodeOnly:function(v){if(U.isInitial(v)){return true;}return false;},popoverShowIncludeValue:function(s){if(s&&s.toUpperCase()==="I"){return true;}return false;},marketingArea:function(d,i){if(!d&&!d.length){return i;}return d;},popoverShowExcludeValue:function(s){if(s&&s.toUpperCase()==="E"){return true;}return false;},tableShowFilterIcon:function(f){if(f){var c=JSON.parse(f);if(c.length>0){return true;}}return false;},showTextLikeToken:function(l,h,s,o){if(o){return U.getTextLikeToken(l,h,s,o);}return"";},filterModified:function(f){if(f){return true;}return false;},cardinalityFormatter:function(c,m){if(c&&m){return c===m?c:c+"/"+m;}return c||m;},fullLocationNodeDescription:function(n,s){return n+" "+s;},tableNodeName:function(n,e){if(!e){return n;}if(e===n){return e;}return n+" ("+e+")";},forecastConfidence:function(c){var i=M.getForecastConfidence();if(i.length<3){return c;}var v=parseFloat(c,10);var l=parseFloat(i[0].Value);var m=parseFloat(i[1].Value);var h=parseFloat(i[2].Value);if(v<=l){return U.getResourceModel().getProperty("ForecastConfidence.Low");}else if(v<=m){return U.getResourceModel().getProperty("ForecastConfidence.Medium");}else if(v<=h){return U.getResourceModel().getProperty("ForecastConfidence.High");}else{return c;}},forecastConfidenceState:function(c){var i=M.getForecastConfidence();if(i.length<3){return sap.ui.core.ValueState.None;}var v=parseFloat(c,10);var l=parseFloat(i[0].Value);var m=parseFloat(i[1].Value);var h=parseFloat(i[2].Value);if(v<=l){return sap.ui.core.ValueState.Error;}else if(v<=m){return sap.ui.core.ValueState.Warning;}else if(v<=h){return sap.ui.core.ValueState.Success;}else{return sap.ui.core.ValueState.None;}},productCount:function(c){var i=U.getI18NModel();var t=i.getResourceBundle().getText("Dynamic");return parseInt(c,10)<0?t:c;}};return F;},true);