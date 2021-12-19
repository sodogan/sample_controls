/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/comp/valuehelpdialog/ValueHelpDialog"],function(V){"use strict";function H(){}H.prototype.selectTreeTablesRows=function(t,r,p,w){var i=0;t.clearSelection();if(!w){p.forEach(function(a){this.expandTreeTableByPath(t,a);}.bind(this));}do{var c=t.getContextByIndex(i);if(!c){continue;}var o=c.getObject();if(this.itemByIdExistsInArray(o.Id,r)){t.addSelectionInterval(i,i);this.refreshTreeTable(t);}i++;}while(c);};H.prototype.expandTreeTableByPath=function(t,p){var a=[];a=p.split("/");a.shift();if(a.length>1){a.pop();}var n="";for(var i=0;i<a.length;i++){n+="/"+a[i];var b=this.getIndexByPath(t,n);if(b!==-1){t.expand(b);this.refreshTreeTable(t);}}};H.prototype.getIndexByPath=function(t,p){var r=-1;var i=0;do{var c=t.getContextByIndex(i);if(c&&c.sPath===p){r=i;break;}i++;}while(c);return r;};H.prototype.itemByIdExistsInArray=function(c,a){return a.some(function(i){return i===c;});};H.prototype.refreshTreeTable=function(t){t.refreshRows(true);t.getModel().refresh(true);};H.prototype.getRowSelectedIdsFromTokens=function(t){var i=[];var p=[];(t||[]).forEach(function(a){if(a){if(a.getKey()){i.push(a.getKey());}var c=a.getCustomData()[0].getValue().currentPath;if(c){var b=c.split("/");b.shift();if(b.length>1){p.push(c);}}}});return[i,p];};H.prototype.HierarhyFilterValueHelpDialog=function(o){return new Promise(function(r,a){var b=function(e){v.close();};var v=new V({supportMultiselect:o.supportMultiselect||false,supportRanges:true,supportRangesOnly:true,stretch:sap.ui.Device.system.phone,title:o.title,displayFormat:"UpperCase",enableMultiLineMode:false,ok:o.ok||b,cancel:function(){v.close();},afterClose:function(){v.destroy();}});v.addStyleClass("sapUiSizeCompact");v.setRangeKeyFields([{key:"ExtHierarchyId",label:o.title}]);if(o.tokens){v.setTokens(o.tokens);}v.open();});};H.prototype.createTokensTypeConditionsFromText=function(c,t){var a=c;var b=[];b=t.split(";");if(!t||!b||b.length<1){return a;}var i=b.length;b.forEach(function(d){var e=new sap.m.Token({text:"="+d,key:"range_"+i});var o={exclude:false,keyField:"ExtHierarchyId",operation:"EQ",value1:d,value2:""};e.addCustomData(new sap.ui.core.CustomData({key:"range",value:o}));a.push(e);i++;});return a;};return H;},true);
