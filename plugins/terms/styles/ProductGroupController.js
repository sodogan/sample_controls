/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Models","retail/pmr/promotionaloffers/plugins/terms/styles/ProductHierarchyController","retail/pmr/promotionaloffers/utils/Utils","retail/pmr/promotionaloffers/utils/ValueHelpDialog"],function(M,P,U,V){function a(e,h,o,i){function u(j,k){e.unsubscribe(h,o,j);e.unsubscribe(h,i,k);}function s(j,k){e.subscribe(h,o,j);e.subscribe(h,i,k);}return new Promise(function(r,j){var k=null,m=null;m=function m(h,q,t){r(t);u(m,k);};k=function k(h,q,t){j(t);u(m,k);};s(m,k);});}function p(m,e){var s={};var i=e;var h=m;var j=U.getI18NModel();s.service=M.getServiceModel();s.complexSearchUrl="/TermObjectSearches";s.dimension="02";s.attributesUrl="/Attributes";s.attributeType="01";s.action="Search";s.skip=0;s.top=100;s.topForSearch=1000;s.filters=[{"Attribute":"PROD_DIM_TCD","Sign":"I","Option":"EQ","Low":"02"},{"Attribute":"MD_SYSTEM_REF","Sign":"I","Option":"EQ","Low":h}];s.inputFilter=i;s.searchValue="";s.title=j.getResourceBundle().getText("Terms.Advanced.ProductGroup");s.supportMultiselect=false;s.supportRanges=false;s.supportRangesOnly=false;s.stretch=sap.ui.Device.system.phone;s.filterAdvancedMode=true;s.filterBarExpand=false;s.showGoOnFB=true;s.FilterPlaceholder=j.getResourceBundle().getText("Terms.Advanced.ProductGroup.Placeholder");s.tableColumns=[{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.Id"),template:"ExtNodeId"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.Name"),template:"Name"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.ExtHierarchy"),template:"ExtHierarchyId"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.Hierarchy"),template:"HierarchyDescription"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.Products"),template:"Cardinality"}];s.oColModelBindName="columns";s.definedFilters=[{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersDescription"),key:"PROD_HR_DESC"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersNodeId"),key:"EXT_NODE_ID"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersNodeName"),key:"NODE_NAME"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersProductId"),key:"EXT_PROD_ID"},{label:j.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersProductName"),key:"PROD_NAME"}];return M.getTermAttributes("02","01").then(function(k){var r=k.data;s.productGroupAttributes=r;var v=V.initCtrl(s,function(o,q){if(q===4){o.setHAlign("End");o.getLabel().setTextAlign("End");var t=new sap.m.Text({text:{path:"Cardinality",formatter:retail.pmr.promotionaloffers.utils.Formatter.productCount}});o.setTemplate(t);}});v.addStyleClass("sapUiSizeCompact");v.open();return a(sap.ui.getCore().getEventBus(),"retail.pmr.promotionaloffers","selectedProductGroup","cancelProductGroup").then(function(k){v.destroy();return M.getProductById(k.selectedProductGroupItem.Id,"02");});});}function n(m,e){return{Dimension:"02",ExtHierarchyId:e,ExtNodeId:e,Name:null,MasterdataSystem:m,Rules:{results:[]},Node:{results:[]},Included:{results:[]},Excluded:{results:[]},Preview:{results:[]},HierarchyPreview:{results:[]},Cardinality:0};}function c(e,i,r){return new Promise(function(h,j){var k=r.navTo("productGroup",true);var v=k.getView("retail.pmr.promotionaloffers.view.ProductGroupTabs","XML");var m=v.getController();m.setResolvers(h,j);m.setProductGroupData(jQuery.extend(true,{},e),i);});}function f(m,e,h,t){var s=M.mergeVisibleProducts(m,h,"02","",t);if(U.getSchemaVersion()<=4){s=M.getProducts(m,h,"02");}function j(k,e){for(var i=0;i<k.length;i++){if(k[i].HierarchyId===e){return k[i];}}return null;}return s.then(function(i){var k=i.Products;var r=j(k,e);if(!r){throw new Error("No product was found with name",h,"and id",e,"in",k);}return r;});}function b(m,e){P.call(this,m,e);this.router=null;this.onCreateProductGroup=this.onCreateProductGroup.bind(this);this.onEditProductGroup=this.onEditProductGroup.bind(this);this.onDisplayProductGroup=this.onDisplayProductGroup.bind(this);}var d=P.prototype;b.prototype=Object.create(d);b.prototype.getDimension=function(){return"02";};b.prototype.openValueHelpDialog=function(e,m){return p(m,e.getSource().getValue());};P.prototype.setRouter=function(r){this.router=r;};function l(h,e,i,j){var t=h;var k=jQuery.extend(true,{},e);var m=e.getSource().getBindingContext().getPath();var o=h.masterdataSystemModel.getProperty("/MasterdataSystem");var q=t.model.getProperty(m);c(i,j,h.router).then(function(r){if(r.skipCall){return Promise.resolve(r);}return f(o,r.ProductGroup.Id,r.ProductGroup.Name,q);}).then(function(i){if(i.skipCall){return;}t.populateModel(t.model,m,i);t.populateUnitOfMeasure(t.model,m,i);t.handleProductDetails(t.productDetails,i,t.model.getProperty(m),true);t.model.setProperty(m+"/ProductErrorState","None");},function(r){t.resetInput(k);});}b.prototype.onEditProductGroup=function(e){var h=jQuery.extend(true,{},e);var i=e.getSource().getBindingContext().getPath();var t=this;M.getProductGroupById(this.model.getProperty(i+"/Selection/HierarchyId")).then(function(r){var j=jQuery.extend(true,{},r);l(t,h,j,false);});};b.prototype.onDisplayProductGroup=function(e){var h=jQuery.extend(true,{},e);var i=e.getSource().getBindingContext().getPath();var t=this;M.getProductGroupById(this.model.getProperty(i+"/Selection/HierarchyId")).then(function(r){var j=jQuery.extend(true,{},r);j.Display=true;l(t,h,j,false);});};b.prototype.onCreateProductGroup=function(e){var h=jQuery.extend(true,{},e);var t=this;var i=e.getSource().getBindingContext().getPath();var m=this.masterdataSystemModel.getProperty("/MasterdataSystem");var j=this.model.getProperty(i+"/ProductTextValue");var k=n(m,j);M.getLeadingCategoriesSet(m).then(function(L){k.LeadingCategorySet=L;});l(t,h,k,true);};function g(e,h,i){var j=e==="02";var k=!!h||!!i;return j&&k;}b.prototype.createLinkVisiblityFormatter=function(e,h,i,j){return!g(e,h,i)||j===null;};b.prototype.editLinkVisiblityFormatter=function(e,h,i,j){return g(e,h,i)&&j!==null;};b.prototype.populateModel=function(m,e,h){var r=P.prototype.populateModel.apply(this,arguments);m.setProperty(e+"/Selection/ExtHierarchyId",h.ExtNodeId);m.setProperty(e+"/Selection/ExtHierarchyNodeId",null);m.setProperty(e+"/Selection/Products",h.ExtNodeId?h.Cardinality:0);return r;};return b;},true);