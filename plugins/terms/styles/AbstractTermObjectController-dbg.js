/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Models", 
               "retail/pmr/promotionaloffers/utils/Utils",
               "sap/ui/core/ListItem"], function(Models, Utils, ListItem){
	
	var EMPTY_TERM = {
		ProductDetail : {}
	};
	
	function pathFromEvent(e, contextName){
		return !e ? null : e.getSource().getBindingContext(contextName).getPath();
	}
	
	function formatSuggestionText(product){
		if(!product){
			return "";
		}
		
		if(!product.ExtNodeId){
			return product.Name;
		}
		
		if(!product.Name){
			return product.ExtNodeId;
		}
		
		return product.ExtNodeId + " - " + product.Name;
	}
	
	function contains(a, b){
		return a.indexOf(b) > -1;
	}
	
	function inputFilterFunction(value, item){
		var data = item.data;
		var lowerCaseValue = value.toLowerCase().trim();
		return contains((data.Name.trim() + "").toLowerCase(), lowerCaseValue) || contains((data.ExtNodeId.trim() + "").toLowerCase(), lowerCaseValue);
	}
		
	function AbstractTermObjectController(model, productDetails){
		this.model = model;
		this.productDetails = productDetails;
		this.masterdataSystemModel = null;
		this.openValueHelpDialog = this.openValueHelpDialog.bind(this);
		this.openValueHelpSearch = this.openValueHelpSearch.bind(this);
		this.openSuggest = this.openSuggest.bind(this);
		this.onSuggestionSelected = this.onSuggestionSelected.bind(this);
		this.onChange = this.onChange.bind(this);
		this.handleProductDetails = this.handleProductDetails.bind(this);
	}
	

	AbstractTermObjectController.prototype.getDimension = function(){
		throw new Error("Not implemented");
	};
	
	
	AbstractTermObjectController.prototype.openValueHelpDialog = function(e){
		throw new Error("Not implemented");
	};
	
	
	AbstractTermObjectController.prototype.populateModel = function(model, path, data){
		throw new Error("Not implemented");
	};	
	
	AbstractTermObjectController.prototype.handleProductDetails = function(productDetailsController, product, term){
		throw new Error("Not implemented");
	};
	
	AbstractTermObjectController.prototype.openValueHelpSearch = function(e){
		var path = pathFromEvent(e);
		var model = this.model;
		var mds = this.masterdataSystemModel.getProperty("/MasterdataSystem");
		var that = this;
		model.setProperty(path + "/ProductBusy", true);
		this.openValueHelpDialog(e, mds).then(function(selection){
			that.populateModel(model, path, selection);
			that.populateUnitOfMeasure(model, path, selection);
			that.handleProductDetails(that.productDetails, selection, that.model.getProperty(path));
			model.setProperty(path + "/ProductErrorState", "None");
			Utils.removeMessagesByPath(path);
			model.setProperty(path + "/ProductBusy", false);
		}, function(oError){
			model.setProperty(path + "/ProductBusy", false);
			jQuery.sap.log.trace(oError);
		});
	};
	
	AbstractTermObjectController.prototype.openSuggest = Utils.throttle(function(e){
		var input = e.getSource();
		input.setFilterFunction(inputFilterFunction);
		var suggestValue = e.getParameter("suggestValue");
		var mds = this.masterdataSystemModel.getProperty("/MasterdataSystem");
		Models.getProducts(mds, suggestValue.trim(), this.getDimension()).then(function(data){
			input.destroySuggestionItems();
			data.Products.map(function(product){
				var item = new ListItem({
					key : product.Id,
					text : formatSuggestionText(product),
					additionalText : product.DimensionName
				});
				item.data = product;
				return item;
			}).forEach(function(item){
				input.addSuggestionItem(item);
			});
		});	
	}, 250);
	
	AbstractTermObjectController.prototype.populateUnitOfMeasure = function(model, path, data){
		var unitsOfMeasure = Utils.get(data, ["UnitOfMeasures", "results"]) || [];
		var sPreviousUoM = model.getProperty(path + "/Selection/UnitOfMeasure");
		if(sPreviousUoM != undefined){
			for(var i = 0; i < unitsOfMeasure.length; i++){
				if(unitsOfMeasure[i].Id == sPreviousUoM){
					var bPreviousUoMExist = true;
				}
			}
		}
		if(!bPreviousUoMExist){
			var defaultUoM = unitsOfMeasure.filter(function(uom){
				return uom.Default;
			})[0] || unitsOfMeasure[0];
			
			model.setProperty(path + "/Selection/UnitOfMeasure", (defaultUoM || {}).Id);
		}
		model.setProperty(path + "/UnitOfMeasures", unitsOfMeasure.map(function(uom){
			return {
				Id : uom.Id,
				Name : uom.Id
			};
		}));
		
		// model.setProperty(path + "/CurrencyList", this.masterdataSystemModel.getProperty("/CurrencyList"));
		
	};

	AbstractTermObjectController.prototype.onSuggestionSelected = function(e){
		var path = pathFromEvent(e);
		var item = e.getParameter("selectedItem");
		var that = this;
		if(!item){
			return Promise.resolve();
		}
		this.suggestionSelected = true;
		that.model.setProperty(path + "/ProductBusy", true);
		return Models.getProductById(item.getKey(), this.getDimension()).then(function(product){
			that.populateModel(that.model, path, product);
			that.populateUnitOfMeasure(that.model, path, product);
			that.handleProductDetails(that.productDetails, product, that.model.getProperty(path));
			Utils.removeMessagesByPath(path);
			that.model.setProperty(path + "/ProductErrorState", "None");
			that.model.setProperty(path + "/ProductBusy", false);
			
			delete that.suggestionSelected;
		}, function(e){
			that.model.setProperty(path + "/ProductBusy", false);
			jQuery.sap.log.trace(e);
		});
	};
	
	AbstractTermObjectController.prototype.onChange = function(e){
		var mds = this.masterdataSystemModel.getProperty("/MasterdataSystem");
		var path = pathFromEvent(e);
		var input = e.getSource();
		var value = input.getValue();	
		
		// Suggestion selected.
		if (this.suggestionSelected) {
			return;
		}
		if (!value) {
			this.resetInput(e);
			return;
		}
		this.model.setProperty(path + "/ProductBusy", true);		
		Models.searchProduct(mds, value.toUpperCase().trim(), this.getDimension()).then(function(data) {
			this.model.setProperty(path + "/ProductBusy", false);
			if (data.Products.length) {
				var product = data.Products[0];
				Utils.removeMessagesByPath(path);
				this.populateModel(this.model, path, product);
				this.populateUnitOfMeasure(this.model, path, product);
				this.handleProductDetails(this.productDetails, product, this.model.getProperty(path));
				this.model.setProperty(path + "/ProductErrorState", "None");
			} else {
				this.populateModel(this.model, path, EMPTY_TERM);
				this.populateUnitOfMeasure(this.model, path, EMPTY_TERM);
				this.handleProductDetails(this.productDetails, null, this.model.getProperty(path));
				input.setValue(value);
				var pathParts = path.split("/");
				var index = parseInt(pathParts[2], 10) + 1;
				var i18n = Utils.getI18NModel();
				var messageManager = Utils.getMessageManager();
				var messages = [{
					message: i18n.getResourceBundle().getText("CreateOffer.Terms.InvalidEntry.Title"),
					description: i18n.getResourceBundle().getText("CreateOffer.Terms.InvalidEntry.Description", index),
					type: "Error",
					target: path,
					processor: this.model
				}];
				if(this.model.getProperty(path + "/ProductErrorState") !== "Error"){
					Utils.setErrorMessages(messageManager, messages);
				} 				
				this.model.setProperty(path + "/ProductErrorState", "Error");
			}
		}.bind(this), function(e){
			jQuery.sap.log.trace(e);
			this.model.setProperty(path + "/ProductBusy", false);
		}.bind(this));
	};
	
	AbstractTermObjectController.prototype.setMasterdataSystemModel = function(masterdataSystemModel){
		this.masterdataSystemModel = masterdataSystemModel;
	};
	
	AbstractTermObjectController.prototype.resetInput = function(e){
		var path = pathFromEvent(e);
		Utils.removeMessagesByPath(path);
		this.populateModel(this.model, path, EMPTY_TERM);
		this.populateUnitOfMeasure(this.model, path, EMPTY_TERM);
		this.handleProductDetails(this.productDetails, null, this.model.getProperty(path));
		this.model.setProperty(path + "/ProductErrorState", "None");
		this.model.setProperty(path + "/ProductBusy", false);
	};	
	
	return AbstractTermObjectController;
}, true);