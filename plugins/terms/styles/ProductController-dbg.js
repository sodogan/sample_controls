/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Models", 
               "retail/pmr/promotionaloffers/plugins/terms/styles/AbstractTermObjectController",
               "retail/pmr/promotionaloffers/utils/Utils"], function(Models, AbstractTermObjectController, Utils){
	
	
	function openValueHelpDialog(masterdataSystem, dimension){
		return new Promise(function(resolve, reject) {
			var sPath = "retail.pmr.promotionaloffers.plugins.terms.controls.search.ProductSearchPage";
			var oController = sap.ui.controller(sPath);
			var oFragment = sap.ui.xmlfragment(sPath, oController);
			oFragment._sOwnerId = Utils.getComponent().getId();
			var i18nTitle = "Terms.Advanced.Product.Title";
			oController.onInit(oFragment, masterdataSystem, dimension, i18nTitle, resolve, reject);
		}).then(function(id){
			return Models.getProductById(id, dimension);
		}, function(error){
			if(error){
				jQuery.sap.log.error(error);
			}
			return Promise.reject(error);
		});
	}
	
	function ProductController(){
		AbstractTermObjectController.apply(this, arguments);
	}
	
	ProductController.openValueHelpDialog = openValueHelpDialog;
	
	ProductController.prototype = Object.create(AbstractTermObjectController.prototype);
	
	ProductController.prototype.getDimension = function(){
		return "01";
	};
	
	ProductController.prototype.handleProductDetails = function(productDetailsController, product, term){
		var removeTerm = jQuery.extend(true, {}, term);
		this.productDetails.remove(removeTerm);
		if(product){
			var children = [product];
			this.productDetails.add(children, term);
		}
	};

	ProductController.prototype.populateModel = function(model, path, data){
		model.setProperty(path + "/Selection/ProductId", data.ProductId);
		model.setProperty(path + "/Selection/HierarchyId", null);
		model.setProperty(path + "/Selection/HierarchyNodeId", null);
		
		model.setProperty(path + "/Selection/ExtProductId", data.ExtNodeId);
		model.setProperty(path + "/Selection/ExtHierarchyId", null);
		model.setProperty(path + "/Selection/ExtHierarchyNodeId", null);
		model.setProperty(path + "/Selection/Description", data.Name);
		
		model.setProperty(path + "/ProductTextValue", data.ExtNodeId);
		model.setProperty(path + "/ProductDescriptionValue", data.Name);
		model.setProperty(path + "/DiscountDescription", data.ProductDetail.Currency);
		model.setProperty(path + "/Selection/Products", data.ProductId ? 1 : 0);
	};
	
	
	ProductController.prototype.openValueHelpDialog = function(e, mds){
		return openValueHelpDialog(mds, "01");
	};
	
	return ProductController;
}, true);
