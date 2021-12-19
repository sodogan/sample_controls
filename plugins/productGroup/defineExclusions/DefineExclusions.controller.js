/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/core/mvc/Controller","sap/ui/model/json/JSONModel","retail/pmr/promotionaloffers/utils/Utils","retail/pmr/promotionaloffers/utils/DateHandler","retail/pmr/promotionaloffers/utils/Formatter"],function(C,J,U,D,F){"use strict";function c(v,i){return v.byId(i).getController();}return C.extend("retail.pmr.promotionaloffers.plugins.productGroup.defineExclusions.DefineExclusions",{constructor:function(){this.contentModel=new J();this.dataModel=new J();this.timeModel=new J();},onInit:function(){this.getView().setModel(this.contentModel,"Content");this.getView().setModel(this.dataModel);this.productsTableController=c(this,"productsTableView");this.productsHierarchyTableController=c(this,"productHierarchyExcluded");var r=U.getResourceModel();this.getView().setModel(r,"i18n");this.contentModel.setProperty("/Editable",true);this.oMessageManager=U.getMessageManager();this.i18nModel=U.getResourceModel();},setTableState:function(b,i){if(i){this.productsHierarchyTableController.setTableState(b);}else{this.productsTableController.setTableState(b);this.productsTableController.removeTableSelections();}},getProductGroupData:function(){var h={Payload:this.productsHierarchyTableController.getProductGroupData()};var d=jQuery.extend({},this.productsTableController.getProductGroupData(),h);return d;},setProductGroupData:function(d,I){this.dataModel.setData(d);this.contentModel.setProperty("/EditableName",I);this.contentModel.setProperty("/ReadOnly",!!d.Display);this.productsTableController.setProductGroupData(d,false);this.productsHierarchyTableController.setProductGroupData(d);},resetProductHierarchy:function(){this.productsHierarchyTableController.resetExcludes();},resetProductSearch:function(){this.productsTableController.resetSearchField();}});});
