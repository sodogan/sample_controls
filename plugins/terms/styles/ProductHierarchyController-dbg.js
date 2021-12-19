/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Models", 
               "retail/pmr/promotionaloffers/plugins/terms/styles/AbstractTermObjectController",
               "retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/utils/TreeValueHelpDialog",
               "retail/pmr/promotionaloffers/utils/ValueHelpDialog"], 
    function(Models, AbstractTermObjectController, Utils, TreeValueHelpDialog, ValueHelpDialog){

	function dialogFromView(viewName, type, masterdataSystem, dimension){
		
		var values = Models.getTermObjects(masterdataSystem, dimension).then(function(result){
			return result.TermObjects;
		}).then(function(groups){
			return Utils.buildTree(groups);
		});
		
		return TreeValueHelpDialog.openDialog({ 
			tableFragment: viewName, 
			title : "{i18n>productHierarchy.Title}", 
			filterProps : ["Title", "SubTitle", "Info1", "Info2"], 
			values : values
		}).then(function(selection){
			return selection.Id;
		});		
	}
	
	function mergeProducts(productsOfGroup, oldProducts, parentId) {
		return productsOfGroup.map(function(item) {
			for (var i = 0; i < oldProducts.length; i++) {
				if (item.ProductId === oldProducts[i].ProductId && parentId ===  oldProducts[i].ParentId) {
					oldProducts[i].isNewItem = false;
					return oldProducts[i];
				}
			}
			item.isNewItem = true;
			return item;
		});
	}
	
	function ProductHierarchyController(){
		AbstractTermObjectController.apply(this, arguments);
	}
	
	ProductHierarchyController.prototype = Object.create(AbstractTermObjectController.prototype);
	
	ProductHierarchyController.prototype.getDimension = function(){
		return "03";
	};
	
	ProductHierarchyController.prototype.handleProductDetails = function(productDetailsController, product, term, shouldMerge){
		var oldProducts = this.productDetails.getProductDetails() || [];
		var termRemove = jQuery.extend(true, {}, term);
		this.productDetails.remove(termRemove);
		if(product){
			var children = (Utils.get(product, [ "Children", "results"]) || []).filter( function(oItem) { return oItem.Dimension === "01"; });
			if(shouldMerge) {
				this.productDetails.add(mergeProducts(children, oldProducts, term.TermType + "-" + term.Identifier), term);
			} else {
				this.productDetails.add(children, term);
			}
		}
	};	
	
	ProductHierarchyController.prototype.populateModel = function(model, path, data){
		model.setProperty(path + "/Selection/ProductId", null);
		model.setProperty(path + "/Selection/HierarchyId", data.HierarchyId);
		model.setProperty(path + "/Selection/HierarchyNodeId", data.HierarchyNodeId);
		
		model.setProperty(path + "/Selection/ExtProductId", null);
		model.setProperty(path + "/Selection/ExtHierarchyId", null);
		model.setProperty(path + "/Selection/ExtHierarchyNodeId", data.ExtNodeId);
		model.setProperty(path + "/Selection/Description", data.Name);
		 
		model.setProperty(path + "/ProductTextValue", data.ExtNodeId);
		model.setProperty(path + "/ProductDescriptionValue", data.Name);
		model.setProperty(path + "/DiscountDescription", data.ProductDetail.Currency);
		model.setProperty(path + "/Selection/Products", data.HierarchyId ? data.Cardinality : 0);
	};
	
	
	ProductHierarchyController.prototype.openValueHelpDialog = function(e, mds){
		return dialogFromView("retail.pmr.promotionaloffers.plugins.terms.controls.search.MerchandiseCategorySearch", "XML", mds, "03").then(function(id){
			return Models.getProductById(id, "03");
		});
	};
	
	return ProductHierarchyController;
}, true);
