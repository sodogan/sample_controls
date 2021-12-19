/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/utils/Models",
               "retail/pmr/promotionaloffers/utils/FinancialCalculations",
               "retail/pmr/promotionaloffers/utils/Formatter"], 
    function(Utils, Models, Calculator, Formatter) {
	"use strict";
 	
	function parentId(term){
		return term.TermType + "-" + term.Identifier;
	}
	
	function concat(a, b){
		return a.concat(b);
	}
	
	function not(fn){
		return function(){
			return !fn.apply(this, arguments);
		};
	}
	
	function withParent(term){
		var pid = parentId(term);
		return function(item){
			return item.ParentId === pid;
		};
	}
	
	function makeFilter(details, that){
		function unique(item, index, array){
			return array.indexOf(item) === index;
		}
		
		function terms(item){
			return item.Terms;
		}
		
		function makeFilterItem(value){
			return {
				Key : value,
				Value : value
			};
		}
		
		var filterItems = details.map(terms).filter(unique).map(makeFilterItem).reduce(concat, []);
		filterItems.push({
			Key : "All Terms",
			Value : that.allTermsLabel()
		});
		
		return filterItems;
	}
	
	function productDetails(model, that, value){
		if(!value){
			return model.getProperty("/ProductDetails") || [];
		}
		var visibleProds = value.filter(function(product) {
			return product.Visibility !== "-";
		});
		model.setProperty("/ProductDetailsVisible", visibleProds);
		model.setProperty("/ProductDetails", value);
		model.setProperty("/ProductDetailsFilter", makeFilter(value, that));
		return value;
	}
	
	function updateProductsPurpose(products, productId, purposeId, selected){
		products.forEach(function(product){
			if(product.ExtProductId === productId) {
				product["_PURPOSE_" + purposeId] = selected;
			}
		});
	}
	
	function defaultUoM(uoms){
		if(!uoms){
			return null;
		}
		
		var firstDefault = uoms.filter(function(uom){
			return uom.Default;
		})[0];
		
		return firstDefault || uoms[0] || null;
	}
	
	function shouldUpdateUoM(uomValue, defaultUoM){
		if(!uomValue){
			return true;
		}
		if(!defaultUoM){
			return false;
		}
		if(uomValue === defaultUoM.Id){
			return true;
		}
		return false;
	}
	
	
	function isSameProduct(a, b){
		if(a.ProductId){
			return a.ProductId === b.ProductId;
		}
		if(a.HierarchyId){
			return a.HierarchyId === b.HierarchyId;
		}
		
		if(a.HierarchyNodeId){
			return a.HierarchyNodeId === b.HierarchyNodeId;
		}
		
		return false;
	}
	
	function unwrapArray(array){
		if(array.results){
			return array.results; 
		}
		
		return array;
	}
	
	function getUoMs(object){
		return Utils.get(object,["UnitOfMeasures"]) || [];
	}
	
	//equivalent to calling unwrapArray(getUoms(x))
	var unwrappedUoMs = Utils.compose(unwrapArray, getUoMs);
	
	//equivalent to calling defaultUoM(unwrapArray(x))
	var unwrappedDefaulUoM = Utils.compose(defaultUoM, unwrapArray, getUoMs);
	
	
	function disableConfigForProperty(detail){
		detail.Config = detail.Config || {};
		return function(property){
			detail.Config[property] = detail.Config[property] || {};
			detail.Config[property].Editable = false;
		};
	}
	
	function handleDimensionSpecificLogic(termInfo, detail){
		
		//Override config for specific cases
		var dimensionType = Utils.get(termInfo, ["Selection", "DimensionType"]);
		
		if (dimensionType === "01") {
			//Allow only changes to display values for dimension 01 - Product
			var userProjection = termInfo.Selection.UserProjection;
			if(jQuery.isNumeric(userProjection)){
				detail.UserProjection = userProjection;	
			}else {
				detail.UserProjection = null;
			}
			
			return ["DiscountValue", "SubDiscountValue", "UserProjection", "LockUserProjection", "PromotedUoM", "PromoCostPrice", "PromoCostPriceCurrency"].forEach(disableConfigForProperty(detail));
		}
		
		if(dimensionType === "11"){
			return ["DiscountValue", "SubDiscountValue", "PromotedUoM"].forEach(disableConfigForProperty(detail));
		}
		
	}
	
	
	function attachIfExists(propName, detail, termInfo){
		var value = detail[propName] || termInfo[propName];
		if(value){
			detail[propName] = value;
		}
	}
	
	
	function attachDataToDetail(detail, product, termInfo){
		
		var defaultUoMForDetail = unwrappedDefaulUoM(detail);
		var defaultUoMForProduct = unwrappedDefaulUoM(product);

		attachIfExists("DiscountValue", detail, termInfo);
		attachIfExists("SubDiscountValue", detail, termInfo);
		attachIfExists("UserProjection", detail, termInfo);

		detail.UnitOfMeasures = unwrappedUoMs(product);
		
		if(product.hasOwnProperty("isNewItem") && product.isNewItem == false){
			var bIsNewItem = false;	
		}else{
			bIsNewItem = true;
		}
		
		if(bIsNewItem){
			if(termInfo.Selection && termInfo.Selection.UnitOfMeasure && termInfo.Selection.UnitOfMeasure != ''){
				detail.DisplayUoM = termInfo.Selection.UnitOfMeasure;
				detail.PromotedUoM = termInfo.Selection.UnitOfMeasure;
			}else{
				detail.DisplayUoM = Utils.get(defaultUoMForProduct, ["Id"]);
				detail.PromotedUoM = Utils.get(defaultUoMForProduct, ["Id"]);
			}
		}

		detail.ExtProductId = product.ExtNodeId || product.ExtProductId;
		
		detail.Name = product.Name;
		
		handleDimensionSpecificLogic(termInfo, detail);
		
		
		return detail;
	}
	
	
	function termObjectToProductDetails(that, termProduct, termInfo){

		var result = {};
		jQuery.extend(true, result, termProduct);
		if (termProduct.UnitOfMeasures && termProduct.UnitOfMeasures.constructor === Array) {
			termProduct.UnitOfMeasures = {results: termProduct.UnitOfMeasures};
		}
		result.ParentId = parentId(termInfo);
		result.ProductId = termProduct.ProductId;
		result.Terms = that.termOrRewardLabel(termInfo);
		result.UnitOfMeasures = (termProduct.UnitOfMeasures || {}).results || [];
		result.DiscountTypeLabel = termInfo.DiscountTypeLabel;
		
		result.Config = jQuery.extend(true, {}, termInfo.ProductConfig);
		result.LockUserProjection = !!result.LockUserProjection;
		for(var value in termInfo.Selection){
			if(termInfo.Selection.hasOwnProperty(value)){
				if(termInfo.Selection[value] && value !== "UserProjection" && value !== "Financials"){
					result[value] = result[value] || termInfo.Selection[value];
				}
			}
		}
		if(jQuery.isNumeric(termProduct.UserProjection)){
			result.UserProjection = parseFloat(termProduct.UserProjection);
		}else {
			result.UserProjection = null;
		}
		result.DiscountType = result.DiscountType || termInfo.DiscountType;
		attachDataToDetail(result, termProduct, termInfo);
		
		return result;
	}
	
	function setProductChanged(prodDetails, relevantDetail, change) {
		var relevantId = relevantDetail.ProductId || relevantDetail.HierarchyNodeId || relevantDetail.HierarchyId;
		
		for(var j = 0; j < prodDetails.length; j++) {
			var prod = prodDetails[j];
			var prodID = prod.ProductId || prod.HierarchyNodeId || prod.HierarchyId;
			if(prod.Terms === relevantDetail.Terms && relevantId === prodID) {
				prod = jQuery.extend(prod, change);
				break;
			}
		}
	}
	
	function ProductDetailsOperation (model) {
		this.model = model;
		this.i18n = Utils.getI18NModel().getResourceBundle();
	}
	
	
	ProductDetailsOperation.prototype.init = function(termsData, purposes){
		var that = this;
		purposes = purposes || [];
		var purposesIds = purposes.map(function(purpose){
			return purpose.Id;
		});
		productDetails(this.model, this, termsData.map(function(term){
			if(!term.TermProducts){
				return [];
			}
			return term.TermProducts.map(function(x){
				var product = jQuery.extend(true,{}, x);
				product.ParentId = parentId(term);
				product.Terms = that.termOrRewardLabel(term);
				product.Name = product.Description;
				product.UnitOfMeasures = (product.UoMs || []).map(function(uom){
					return { 
						Name : uom.Unit,
						Id : uom.Unit
					};
				});	
				product.PromoCostPriceCurrency = product.PromoCostPriceCurrency || product.Currency;
				// set default value on purposes
				(purposesIds || []).forEach(function(purposeId) {
					product["_PURPOSE_" + purposeId] = false;
				});
				
				(product.Purposes || []).forEach(function(purpose){
					if(purposesIds.indexOf(purpose.Id) !== -1) {
						product["_PURPOSE_" + purpose.Id] = true;
					}
				});
				
				product.ServerUserProjection = product.ServerUserProjection;
				if(jQuery.isNumeric(product.UserProjection)){
					product.UserProjection = parseFloat(product.UserProjection);	
				}else {	
					product.UserProjection = null;
				}
				
				product.DiscountTypeLabel = term.DiscountTypeLabel;
				product.ForecastConfidenceLabel = Formatter.forecastConfidence((product.Financials || {}).ForecastConfidence || 0);
				product.DiscountType = term.DiscountType || Utils.get(term, ["Selection", "DiscountType"]);
				product.Config = jQuery.extend(true, {}, term.ProductConfig);
				handleDimensionSpecificLogic(term, product);
				
				Calculator.extendFinancials(product.Financials);
				
				return product;
			});
		}).reduce(concat, []));
		that.model.setProperty("/AllPurposes", purposes.length && purposes[0].Id ? purposes : [] );
	};
	
	ProductDetailsOperation.prototype.getProductDetails = function(){
		return this.model.getProperty("/ProductDetails") || [];
	};
	
	ProductDetailsOperation.prototype.calculateTotalProducts = function() {
		var total = 0;
		var terms =  this.model.getProperty("/Terms") || [];
		var isWholeOffer = function(item) {
			return item.isWholeOffer;
		};
		var rewards = (this.model.getProperty("/Rewards") || []).filter(isWholeOffer);
		var termsRewards = terms.concat(rewards);
		var nrDetails = (this.model.getProperty("/ProductDetails") || {}).length || 0;
		termsRewards.forEach(function(term){
			if((term.Selection || {}).hasOwnProperty("Products")) {
				total += term.Selection.Products;
			}
		});
		this.model.setProperty("/ProductDetailsTotal", total ? total : nrDetails);
	};

	ProductDetailsOperation.prototype.remove = function(term){
		var details = productDetails(this.model);
		productDetails(this.model, this, details.filter(not(withParent(term))));
		if(term.Selection && term.Selection.hasOwnProperty("Products")) {
			// Force to clean products before calculate
			term.Selection.Products = 0;
		}
		
		this.calculateTotalProducts(term);
	};
	
	ProductDetailsOperation.prototype.add = function(products, termInfo){
		var that = this;
		var newDetails = products.map(function(product){
			return termObjectToProductDetails(that, product, termInfo);
		});
		productDetails(this.model, this, productDetails(this.model).concat(newDetails));
		this.calculateTotalProducts();
	};
	
	ProductDetailsOperation.prototype.termOrRewardLabel = function(term){
		var text;
		if(term.TermType === "1") {//buy
			text = this.termLabel(term.Identifier);
		}else{ //get
			text = this.rewardLabel(term.Identifier);
		}
		return text.trim();
	};
	
	
	ProductDetailsOperation.prototype.updateIdentifiers = function(changes){
		var that = this;
		productDetails(this.model, productDetails(this.model).map(function(detail){
			var parent = detail.ParentId;
			
			for(var i = 0; i < changes.length; i++){
				if(parentId(changes[i].oldTerm) === parent){
					detail.ParentId = parentId(changes[i].newTerm);
					detail.Terms = that.termOrRewardLabel(changes[i].newTerm);
				}
			}
			
			return detail;
			
		}));
		
	};
	
	ProductDetailsOperation.prototype.termLabel = function(id){
		return jQuery.sap.formatMessage(this.i18n.getText("CreateOffer.Terms.Freestyle.TermLabel"), "", id);
	};
	
	ProductDetailsOperation.prototype.rewardLabel = function(id){
		return jQuery.sap.formatMessage(this.i18n.getText("CreateOffer.Terms.FreestyleOffer.Reward"), id);
	};
	
	ProductDetailsOperation.prototype.allTermsLabel = function(){
		return this.i18n.getText("CreateOffer.Terms.FreestyleOffer.AllTermFilterLabel");
	};
	
	
	ProductDetailsOperation.prototype.update = function(term, property, value){
		var details = productDetails(this.model);
		var isParent = withParent(term);
		productDetails(this.model, this, details.map(function(detail){
			if (isParent(detail)) {
				detail[property] = value;
			}
			return detail;
		}));
	};

	
	function findByProductId(productsFromTermObj, productId) {
		var termProduct = {UnitOfMeasures : [], Name : ""};
		for (var i = 0; i < productsFromTermObj.length; i++) {
			var item = productsFromTermObj[i];
			if (item.ProductId === productId) {
				termProduct = item;
				break;
			}
		}
		return termProduct;
	}
	
	
	function detailsUnitOfMeasure(detail, parentTerm){
		if(detail.UnitOfMeasures && detail.UnitOfMeasures.length > 0){
			return detail.UnitOfMeasures; 
		}
		
		return Utils.get(parentTerm, ["UnitOfMeasures", "results"]) || []; 
	}
	
	ProductDetailsOperation.prototype.updateDetailsForEveryProduct = function(term, productsFromTermObj){
		var details = productDetails(this.model);
		var isParent = withParent(term);
		productDetails(this.model, this, details.map(function(detail){
			if (isParent(detail)) {
				var termProduct = findByProductId(productsFromTermObj, detail.ProductId);
				detail.UnitOfMeasures = detailsUnitOfMeasure(detail, termProduct);
				detail.Name = detail.Name ? detail.Name : termProduct.Name;
			}
			return detail;
		}));
	};
	
	ProductDetailsOperation.prototype.updateDetails = function(products, term){
		var prodDetails = productDetails(this.model);
		productDetails(this.model, this, prodDetails.map(function(detail){
			for(var i = 0; i < products.length; i++){
				if(isSameProduct(products[i], detail)){
					return attachDataToDetail(detail, products[i], term);
				}	
			}
			return detail;
		}));
	};

	
	function indexedDetail(x, indexOfX){
		return {
			ParentId : x.ParentId,
			Index : indexOfX
		};
	}
	
	function getIndex(x){
		return x.Index;
	}
	
	ProductDetailsOperation.prototype.getIndicesForTerm = function(term){
		var details = productDetails(this.model);
		
		return details.map(indexedDetail)
					  .filter(withParent(term))
					  .map(getIndex);
	};
	
	ProductDetailsOperation.prototype.subGroupChecked = function(data){
		var products = this.getProductDetails();
		var purposeId = Utils.getSubstringEndText("_PURPOSE_", data.name);
		updateProductsPurpose(products, data.data.ExtProductId, purposeId, data.selected);
	};
	
	ProductDetailsOperation.prototype.hideProducts = function(changes){
		var prodDetails = productDetails(this.model);
		var visibleProds = this.model.getProperty("/ProductDetailsVisible") || [];
		
		for(var i = 0; i < changes.length; i++) {
			var change = jQuery.extend({}, changes[i]);
			var relevantDetail = visibleProds[change.Index];
			delete change.Index;
			
			setProductChanged(prodDetails, relevantDetail, change);
		}
		productDetails(this.model, this, prodDetails);
	};
	
	ProductDetailsOperation.prototype.massChange = function(changes){
		var prodDetails = productDetails(this.model);
		var visibleProds = this.model.getProperty("/ProductDetailsVisible") || [];
		
		for(var i = 0; i < changes.length; i++){
			var change = jQuery.extend({}, changes[i]);
			var relevantDetail = visibleProds[change.Index];
			
			delete change.Index;
			
			setProductChanged(prodDetails, relevantDetail, change);
			
			Object.keys(change).forEach(function(key){
				if(key.indexOf("_PURPOSE_") !== -1) {
					var purposeId = Utils.getSubstringEndText("_PURPOSE_", key);
					updateProductsPurpose(prodDetails, relevantDetail.ExtProductId, purposeId, change[key]);
				}
			});
		}
	
		productDetails(this.model, this, prodDetails);
	};
	
	
	ProductDetailsOperation.prototype.validateItem = function(detail, property){
		var value = detail[property];
		var i18n = Utils.getI18NModel().getResourceBundle();
		var detailIndex = productDetails(this.model).indexOf(detail);
		var path = "/ProductDetails/" + detailIndex + "/" + property;
		
		var propertyLabel = i18n.getText("ManageOffers.ProductDetails." + property);
		
		var errorMessage = "";
		var sFormattedMessage = "";
		if(["UserProjection", "PromoCostPrice", "DisplayUoMValue"].indexOf(property) > -1){
			errorMessage = i18n.getText("ManageOffer.ProductDetail.Error.RegularValueValidationError");
			if(value < 0){
				Utils.addValidationMessages({ message : jQuery.sap.formatMessage(errorMessage, propertyLabel)}, path, this.model);
			}else{
				Utils.addValidationMessages({ message : null }, path, this.model);
			}
			
		}else if(["PromotedUoM", "DisplayUoM", "PromoCostPriceCurrency"].indexOf(property) > -1){
			errorMessage = i18n.getText("ManageOffer.ProductDetail.Error.InvalidEntryError");
			if(value === "" || value === null || value === undefined){
				Utils.addValidationMessages({ message : jQuery.sap.formatMessage(errorMessage, propertyLabel)}, path, this.model);
				sFormattedMessage = jQuery.sap.formatMessage(errorMessage, propertyLabel);
			}else {
				Utils.addValidationMessages({ message : null }, path, this.model);
			}
		}
		return sFormattedMessage;
	};
	
	ProductDetailsOperation.prototype.getEditableFields = function() {
		if(this._editableFields) {
			return this._editableFields;
		}
		var model = Models.getServiceModel();
		if(model.isMetadataLoadingFailed()) {
			return [];
		}
		
		var namespace = Models.getNamespace(model);
		var entity = model.getMetaModel().getODataEntityType(namespace + ".TermProduct");
		this._editableFields = entity.property.filter(function(prop) {
			return prop["sap:creatable"] !== "false" || prop["sap:updatable"] !== "false";
		}).map(function(field) {
			return field.name;
		});
		return this._editableFields;
	};
	ProductDetailsOperation.prototype.getForTermData = function(term){
		return productDetails(this.model).filter(withParent(term));
	};
	ProductDetailsOperation.prototype.getForTerm = function(term){
		
		var editableFields = this.getEditableFields();
		return productDetails(this.model).filter(withParent(term)).map(function(item){
			var promoCostFlag = false;
			if (item.PromoCostPrice && parseFloat(item.PromoCostPrice) > 0) {
				promoCostFlag = true;
			}
			
			var uoms = Utils.get(item, ["UnitOfMeasures", "length" ]) ? item.UnitOfMeasures : [{Id : ""}];
			
			var userProjection = (item.UserProjection || "0") + "";
			var userProjectionLock = !!item.LockUserProjection;
			var purposes = [];
			Object.keys(item).forEach(function(field){
				if(field.indexOf("_PURPOSE_") !== -1 && item[field]) {
					purposes.push({
						Id: Utils.getSubstringEndText("_PURPOSE_", field)
					});
				}
			});
			var defaultObj = {
				"Purposes": purposes.length ? purposes : null,
	            "ProductId": item.ProductId,
	            "Description" : item.Name,
	            "ExtProductId": item.ExtProductId,
	            "DiscountValue": item.DiscountValue ? item.DiscountValue + "" : "0",
	            "SubDiscountValue": item.SubDiscountValue ? item.SubDiscountValue + "" : "0",
	            "Currency": item.Currency || "",
	            "PromotedUoM": item.PromotedUoM || "",
	            "DisplayUoM": item.DisplayUoM || "",
	            "DisplayUoMValue": item.DisplayUoMValue ? item.DisplayUoMValue + "" : "0",
	            "PromoCostPrice": item.PromoCostPrice ? item.PromoCostPrice + "" : "0",
	            "PromoCostPriceCurrency": item.PromoCostPriceCurrency || "",
	            "UsePromoCostPrice": !!promoCostFlag,
	            "LockUserProjection": userProjectionLock,
	            "UserProjection": userProjection,
	            "ServerUserProjection" : item.ServerUserProjection,
	            "Financials" : { "Id" : "" },
	            "UoMs" : uoms.map(function(uom){
	            	return { Unit : uom.Id };
	            })
			};
			if(item.hasOwnProperty("Visibility")) {
				defaultObj.Visibility = item.Visibility;
			}
			// Add the fields that are editable and not in the default mapping
			editableFields.forEach(function(name){
				if(!defaultObj.hasOwnProperty(name) && item.hasOwnProperty(name)) {
					defaultObj[name] = item[name];
				}
			});
			
			return defaultObj;
			
		});
	};

	return ProductDetailsOperation;
}, true);