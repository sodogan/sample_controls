/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function(){
	function communicationWrapper(wrapperFunction){
   		return function(loader){
   			this.onInit = loader.onInit.bind(loader);
   	   		
   	   		this.getOfferData = loader.getOfferData.bind(loader);
   	   		this.getStaticData = loader.getStaticData.bind(loader);
   	   		this.getHeaders = loader.getHeaders.bind(loader);
   	   		this.createSavePayload = loader.createSavePayload.bind(loader);
   	   		this.hasChanges = loader.hasChanges.bind(loader);
   	   		this.setOfferDataProvider = loader.setOfferDataProvider.bind(loader);
   	   		this.createSavePayloadWithFinancials = loader.createSavePayloadWithFinancials.bind(loader);
   	   		this.processData = loader.processData.bind(loader);
   	   		this.storeSnapshot = loader.storeSnapshot.bind(loader);
   	   		this.getSnapshot = loader.getSnapshot.bind(loader);
   	   		this.saveOffer = loader.saveOffer.bind(loader);
   	   		this.calculateFinancials = loader.calculateFinancials.bind(loader);
   	   		this.determineVendorFunds = loader.determineVendorFunds.bind(loader);
   	   		this.calculateForecast  = loader.calculateForecast.bind(loader);
   	   		this.detectCollisions =  loader.detectCollisions.bind(loader);
   	   		wrapperFunction.apply(this, arguments);
   		};
   	}
   	
   	var UIHiderCommunicationWrapper = communicationWrapper(function(loader, model){
   		this.onInit = function(){
   			model.setProperty("/Visible", false);
   			return loader.onInit.apply(loader, arguments).then(function(result){ 
   				model.setProperty("/Visible", true);
   				return result;
   			}, function(e){
   				model.setProperty("/Visible", true);
   				throw e;
   			});
   		};
   	});
   	
   	var PleaseWaitCommunicationWrapper = communicationWrapper(function(loader, loadDialog, saveDialog){
   		/*
   		 * Wraps a method of given object with a please wait dialog
   		 * method needs to return a promise.
   		 */
   		function wrap(dialog, object, name){
   			var DELAY_TIME = 100;
   			function closeDialog(oDialog, delay){
   				clearTimeout(delay);
   				oDialog.close();
   			}
   			return function wrappepWithPleaseWait(){
   				var delay = setTimeout(function(){
   					dialog.open();
   				}, DELAY_TIME);
   	   			return loader[name].apply(loader, arguments).then(function(result){
   	   				closeDialog(dialog, delay);	
   	   				return result;
   	   			},function(error){
   	   				closeDialog(dialog, delay);
   	   				throw error;
   	   			});
   	   		};
   		}

   		this.onInit = wrap(loadDialog, this, "onInit");
   		this.saveOffer = wrap(saveDialog, this, "saveOffer");
   	});
   	
   	var ActionAllowCommunicationWrapper = communicationWrapper(function(loader, actionAllowedModel){
   			function wrap(model, context, method){
   				return function wrappedInActionAllowed(){
   					model.setProperty("/ActionAllowed", false);
   					return context[method].apply(context, arguments).then(function(result){
   						model.setProperty("/ActionAllowed", true);
   						return result;
   					}, function(e){
   						model.setProperty("/ActionAllowed", true);
   						return Promise.reject(e);
   					});
   				};
   			}
   		
   			this.saveOffer = wrap(actionAllowedModel, loader, "saveOffer");
	   		this.calculateFinancials = wrap(actionAllowedModel, loader, "calculateFinancials");
	   		this.determineVendorFunds = wrap(actionAllowedModel, loader, "determineVendorFunds");
	   		this.calculateForecast = wrap(actionAllowedModel, loader, "calculateForecast");
	   		this.detectCollisions = wrap(actionAllowedModel, loader, "detectCollisions");
   	});
   	
   	return {
   		showPleaseWait : PleaseWaitCommunicationWrapper,
   		hideUI : UIHiderCommunicationWrapper,
   		allowActions : ActionAllowCommunicationWrapper
   	};
}, true);