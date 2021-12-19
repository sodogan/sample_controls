/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/plugins/terms/styles/ProductHierarchyController",
               "retail/pmr/promotionaloffers/plugins/terms/styles/ProductController"], function(ProductHierarchyController, ProductController){
	
	function GenericProductController(model, productDetails, dimension){
		ProductHierarchyController.call(this, model, productDetails);
		this.dimension = dimension;
	}
	
	GenericProductController.prototype = Object.create(ProductHierarchyController.prototype);
	
	GenericProductController.prototype.getDimension = function(){
		return this.dimension;
	};
	
	GenericProductController.prototype.openValueHelpDialog = function(e, mds){
		return ProductController.openValueHelpDialog(mds, this.dimension);
	};
	
	GenericProductController.prototype.populateModel = function(model, path, data){
		return ProductController.prototype.populateModel.call(this, model, path, data);
	};
	return GenericProductController;
}, true);