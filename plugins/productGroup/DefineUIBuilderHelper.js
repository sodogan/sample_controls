/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils","retail/pmr/promotionaloffers/utils/Models","retail/pmr/promotionaloffers/utils/Constants","sap/ui/model/json/JSONModel","sap/ui/model/Filter"],function(U,M,C,J,F){var D=function(c,a,r,p,f){this.controlConfigurations=c;this.filters=a;this.radioVisible=r;this.parentContext=p;this.filterValues=f;this.i18nBundle=U.getResourceModel().getResourceBundle();this.defaultCtrlsVisible=[];this.controlls=[];this.multiInputs=[];this.radioGroup=null;this.oMoreFilters=null;this.additionalFilters=[];this.radioSelectListeners=[];this.calculateVisibleFilters();this.calculateAdditionalFilters();this.generateControls();};D.prototype.createHorizontalLayout=function(c){return new sap.ui.layout.HorizontalLayout({content:c});};D.prototype.removeOldContent=function(){var c=this.parentContext.dialog.getContent();if(c&&c.length>=2){var g=c[1];var r=g.getContent()[0];var f=g.getContent()[1];g.removeContent(r);g.removeContent(f);return g;}return null;};D.prototype.generateControls=function(){var t=this;this.controlls=[];var a=function(i){var g=t.createGrid();var l=new sap.m.Label({text:i["sap:label"]||i[0]["sap:label"],width:"150px"});var c=i.control||i[0].control;c.setWidth("300px");c.searchKey=i.name;var h=t.createHorizontalLayout([l,c]);g.addContent(h);t.multiInputs.push(c);t.controlls.push(g);};this.defaultCtrlsVisible.forEach(a);if(this.additionalFilters&&this.additionalFilters.length>0){this.additionalFilters.forEach(a);}};D.prototype.generateMoreFiltersCtrl=function(){var t=this;var g=this.createGrid();var l=new sap.m.Label({text:"",width:"150px",visible:false});var a=new sap.m.Link({text:t.i18nBundle.getText("Product.Groups.Filter.More.Link"),press:t.handleMoreFilterPress.bind(t)});g.addContent(this.createHorizontalLayout([l,a]));return g;};D.prototype.handleMoreFilterPress=function(e){var t=this;this.oMoreFilters=sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.productGroup.fragments.MoreFilters",this);this.oMoreFilters.setModel(U.getResourceModel(),"i18n");var d=new J();var f=this.filters.map(function(i){var a=false;t.defaultCtrlsVisible.forEach(function(v){if(v.fieldName===i.fieldName){a=true;}});return{Property:i.fieldName,Label:i.fieldLabel,isSelected:a?true:false};});d.setProperty("/CheckboxFilters",f);this.oMoreFilters.setModel(d);this.oMoreFilters.open();};D.prototype.createPanel=function(){var p=new sap.m.Panel({expandable:false,expanded:true,width:"100%"});return p;};D.prototype.createGrid=function(d,a){var g=new sap.ui.layout.Grid({defaultSpan:d||"L12 M12 S12",defaultIndent:a||"L0 M0 S0"});g.setVSpacing(0);return g;};D.prototype.createButtonsArry=function(){var t=this;var a=new sap.m.RadioButton({text:t.i18nBundle.getText("Product.Groups.Radion.Btn.All.Unmodified.Subnodes")});var b=new sap.m.RadioButton({text:t.i18nBundle.getText("Product.Groups.Radion.Btn.All.Subnodes")});var o=new sap.m.RadioButton({text:t.i18nBundle.getText("Product.Groups.Radion.Btn.Only.This.Node")});return[a,b,o];};D.prototype.fireRadioSelect=function(e){this.radioSelectListeners.forEach(function(l){return l(e);});};D.prototype.addRadioListener=function(l){this.radioSelectListeners.push(l);};D.prototype.createRadioGroup=function(){var t=this;var g=this.createGrid();this.radioGroup=new sap.m.RadioButtonGroup({buttons:t.createButtonsArry()});this.radioGroup.attachSelect(function(e){t.fireRadioSelect(e);});var l=new sap.m.Label({text:t.i18nBundle.getText("Product.Groups.Apply.Changes.To")});l.addStyleClass("sapUiTinyMarginTop");var h=this.createHorizontalLayout([l,this.radioGroup]);g.addContent(h);return g;};D.prototype.getCtrlsForDialog=function(e){var p=null;var f=null;if(C.DialogModeEnum.WithRadio===this.radioVisible){p=this.createPanel();p.addContent(this.createRadioGroup());}if(this.controlls&&this.controlls.length>0){f=this.createPanel();this.controlls.forEach(function(c){f.addContent(c);});f.addContent(this.generateMoreFiltersCtrl());}var g=null;if(!e){g=this.createGrid();}else{g=e;}if(f){g.insertContent(f);}if(p){g.insertContent(p);}return g;};D.prototype.calculateVisibleFilters=function(n){var t=this;this.defaultCtrlsVisible=[];function i(f){t.defaultCtrlsVisible.push(f);}if(n&&n.length>0){n.forEach(i);}else{this.controlConfigurations.map(function(a){var b=a.getKey();return t.filters.filter(function(f){return f.fieldName===b;});}).forEach(i);}};D.prototype.handleSearch=function(e){if(e.getSource().getParent()&&e.getSource().getParent().getItems().length>0){var f=[];var q=e.getSource().getValue();if(q&&q.length>0){var a=new F("Label",sap.ui.model.FilterOperator.Contains,q);f.push(a);}var l=e.getSource().getParent().getItems()[1];var b=l.getBinding("items");b.filter(f,"Application");}};D.prototype.onMoreFiltersCancel=function(e){this.oMoreFilters.close();this.oMoreFilters.destroy();};D.prototype.onMoreFiltersOk=function(e){var v=this.oMoreFilters.getModel().getData().CheckboxFilters.filter(function(i){return i.isSelected;}).map(function(i){return i.Property;});this.parentContext.updateFilters(v);};D.prototype.destroyDialog=function(){this.oMoreFilters.close();this.oMoreFilters.destroy();};D.prototype.redrawFilters=function(n){this.calculateVisibleFilters(n);var g=this.removeOldContent();this.generateControls();return g;};D.prototype.getRadioSelection=function(){return this.radioGroup.getSelectedIndex();};D.prototype.calculateAdditionalFilters=function(){var t=this;if(this.filterValues&&this.filterValues.length>0){var a=this.filterValues.map(function(i){return{Property:i.Property};});var n=[];a.forEach(function(f){var b=n.some(function(i){return i.Property===f.Property;});if(!b){n.push(f);}});var u=[];n.forEach(function(f){var b=t.controlConfigurations.some(function(i){return i.getKey()===f.Property;});if(!b){u.push(f);}});t.additionalFilters=[];if(u&&u.length>0){this.filters.forEach(function(i){u.forEach(function(b){if(b.Property===i.fieldName){t.parentContext.smartFilterBar.addFieldToAdvancedArea(i.fieldName);t.additionalFilters.push(i);}});});}}};return D;});
