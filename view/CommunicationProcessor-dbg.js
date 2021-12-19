/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils", 
               "retail/pmr/promotionaloffers/utils/Models",
               "retail/pmr/promotionaloffers/utils/ExtensibilityConfig"], function(Utils, Models, ExtensibilityConfig){
	"use strict";
	
	function pipe(context, fns){
		function call(context, fn){
			return function(data){
				return fn.call(context, data);
			};
		}
		return function(input){
			var result = Promise.resolve(input);
			fns.forEach(function(fn){
				result = result.then(call(context, fn));
			});
			return result;
		};
	}
	
	function isWrappedCollection(object){
		return object && object.hasOwnProperty("results");
	}
	
	function isDeferdObject(object){
		return object && object.hasOwnProperty("__deferred");
	}
	
	
	function unwrapCollection(object){
		return object.results;
	}
	
	function isPrimitive(object){
		return typeof object === "string" || 
			   typeof object === "number" || 
			   typeof object === "boolean" || 
			   typeof object === "undefined" || 
			   object === null;
	}
	
	function addServerUserProjection(data) {
		var terms = data.Terms;
		if(terms) {
			for(var i = 0, tl = terms.length; i < tl; i++){
				var productDetails = terms[i].TermProducts;
				if(!productDetails) {
					continue;
				}
				for(var j = 0, pl = productDetails.length; j < pl; j++){
					var detail = productDetails[j];
					detail.ServerUserProjection = detail.UserProjection;
				}
			}
		}
	}
	
	function cleanUoMs(data) {
		var terms = data.Terms;
		if(terms && terms.length) {
			for(var i = 0, tl = terms.length; i < tl; i++){
				var productDetails = terms[i].TermProducts;
				terms[i].UoMs = [{}];
				delete terms[i].Products;
				if(!productDetails) {
					continue;
				}
				for(var j = 0, pl = productDetails.length; j < pl; j++){
					productDetails[j].UoMs = [{}];
				}
			}
		}
	}

	function cleanCurrencyList(data) {
		var terms = data.Terms;
		if(terms && terms.length) {
			for(var i = 0, tl = terms.length; i < tl; i++){
				var productDetails = terms[i].TermProducts;
				if (Utils.getSchemaVersion() < 4) {
				  delete terms[i].PromoCostPriceCurrency;
				}
				if(!productDetails) {
					continue;
				}
				for(var j = 0, pl = productDetails.length; j < pl; j++){
					if (Utils.getSchemaVersion() < 4) {
						delete productDetails[j].PromoCostPriceCurrency;
					}
				}
			}
		}
	}	
	
	/** 
	 * replaces all initial values with null.
	 * An Initial value is determined with the 'isInitial' functions
	 * 
	 * @param {object} object - an object
	 * @returns {object} and object with same structure as input, but initial values are replaces by null values 
	 */
	function replaceInitialWithNull(object){
		if(isPrimitive(object)){
			return object || {};
		}
		if(object instanceof Date){
			return object;
		}
		var newData = {};
		 Object.keys(object || {}).forEach(function(key){
			 if(key === "EnforceMultiple"){
				 newData[key] = object[key];
				 return;
			 }
			 if(Utils.isInitial(object[key])){
				 newData[key] = null;
				 return;
			 }else if(Utils.isInitial(object[key])){
				 newData[key] = null;	 
			 }else if(jQuery.isArray(object[key])){
				 newData[key] = [];
				 for(var i = 0; i < object[key].length; i++){
					 newData[key][i] = replaceInitialWithNull(object[key][i]);
				 }
			 }else if(typeof object[key] === "object"){
				 newData[key] = replaceInitialWithNull(object[key]);
			 }else{
				 newData[key] = object[key];
			 }
			 
		 });
		 return newData;
	}
	
	function clone(object){
		return jQuery.extend(true, {}, object);
	}
	
	function getStartOfToday(){
		var today = new Date();
		today.setHours(0, 0, 0, 0);
		return today;
	}
	
	function getEndOfToday(){
		var today = getStartOfToday().getTime();
		
		var ONE_MINUTE = 60000;
		var ONE_SECOND = 1000;
		var ONE_DAY = 24 * 60 * ONE_MINUTE;
		//end of today is 23:59:59 (or 11:59:59 PM)
		return new Date(today + ONE_DAY - ONE_SECOND);
	}
	
	/**
	 * Removes all empty strings and null properties from object
	 * @param {object} object - an object
	 * @returns {object} an object with all the keys of the original except for the ones that are null or empty strings
	 */
   	function stripEmpty(object){
   		var stripEmptyAnObject = function(object) {
   			for(var key in object){
				if(object.hasOwnProperty(key)){
					if(object[key] === "" || object[key] === null){
						if(key !== "Id" && key !== "Unit" && key !== "EnforceMultiple") {
							delete object[key];
						}
					}
					if(Array.isArray(object[key])) {
						object[key].forEach(function(item) {
							if (item instanceof Object) {
								stripEmptyAnObject(item);
							}
							
						});
					}
				}
			}
   		};
   		stripEmptyAnObject(object);
		return object;
	}
	
	function log(name){
		return function(data){
			jQuery.sap.log.getLogger().debug(name, JSON.stringify(data));
			return data;
		};
	}
	
	function processDates(payload){
		if(payload.StartOfOffer){
			payload.StartOfOffer = Utils.getFormatedDateForSave(payload.StartOfOffer);
		}
		if(payload.EndOfOffer){
			payload.EndOfOffer = Utils.getFormatedDateForSave(payload.EndOfOffer);
		}
		
		if(payload.Tactics){
			payload.Tactics.forEach(function(t){
				t.StartOfTactic = Utils.getFormatedDateForSave(t.StartOfTactic);
				t.EndOfTactic = Utils.getFormatedDateForSave(t.EndOfTactic);
			});
		}
		if(payload.Versions){
			payload.Versions.forEach(function(v){
				v.StartOfOffer = Utils.getFormatedDateForSave(v.StartOfOffer);
				v.EndOfOffer = Utils.getFormatedDateForSave(v.EndOfOffer);
			});
		}
		return payload;
	}
	
	
	var READ_OFFER_EXPANSIONS_CAR200 = "Terms,Terms/Financials,Terms/TermProducts,Terms/TermProducts/Financials,ExcludedNodes," + 
	"Terms/Incentives,Incentives,Tactics,VendorFunds,Attributes,AvailableFunds,TargetGroups," + 
	"Versions,Versions/Terms,Versions/Terms/Financials,Versions/Terms/TermProducts/Financials,Versions/Terms/TermProducts,Versions/Incentives,Versions/Terms/Incentives,LocationHierarchy," + 
	"LocationHierarchy/Locations,LocationFilters,LocalNodes,LocalNodes/Children";
	
	var READ_OFFER_EXPANSIONS = READ_OFFER_EXPANSIONS_CAR200 + ",Terms/UoMs,Terms/TermProducts/UoMs,Versions/Terms/UoMs,Versions/Terms/TermProducts/UoMs";

	var READ_OFFER_EXPANSIONS_NEWFEATURES = READ_OFFER_EXPANSIONS + ",Terms/TermProducts/Purposes" +
	",LocationSubgroups,LocationSubgroups/Filters,LocationSubgroups/Locations,Versions/Terms/TermProducts/Purposes";

	function CAR3Workflow(){
	}
	
	function fetchOfferData(processor, expands){
		return function(){
			return processor.service.fetchOfferData(expands);
		};
	}
	
	function processData(processor){
		return function(data){
			return processor.processData(data);
		};
	}
	
	function cleanUoMsPayload(payload) {
		cleanUoMs(payload);
		if (Array.isArray(payload.Versions)) {
			(payload.Versions || []).forEach(cleanUoMs);
		}
		return payload;
	}
	
	function cleanCurrencyListPayload(payload) {
		cleanCurrencyList(payload);
		if (Array.isArray(payload.Versions)) {
			(payload.Versions || []).forEach(cleanCurrencyList);
		}
		return payload;
	}
	
	function cleanCAR3Payload(payload) {
		cleanUoMsPayload(payload);
		cleanCurrencyListPayload(payload);
		return payload;
	}
	
	CAR3Workflow.prototype.onInit = function(processor){
		var initializeOfferData = pipe(processor, 
				[fetchOfferData(processor, READ_OFFER_EXPANSIONS + ExtensibilityConfig.getExpand()),
				 log("fetched offer data"),
				 processData(processor)]);
		
		var initializeStaticContent = pipe(processor, 
				[processor._fetchStaticData, processor._setStaticData]);
		
		return Promise.all([ initializeOfferData(), initializeStaticContent()]);
	};
	
	CAR3Workflow.prototype.saveOffer = function(processor, payload){
		return processor.service.saveOffer(cleanCAR3Payload(payload), READ_OFFER_EXPANSIONS + ExtensibilityConfig.getExpand());
	};
	
	CAR3Workflow.prototype.calculateFinancials = function(processor, payload){
		return Models.getFinancials(cleanCAR3Payload(payload)).then(function(data) {
			
			var resultData = data.data;
			var responses = Utils.get(data, ["returnedData", "__batchResponses"]) || [];
			var hasErrors = responses.map(function(res){
				var body = Utils.get(res, ["response", "body"]);
				return body && body.indexOf("error") > -1;
			}).reduce(function(a, b) { return a || b; }, false);
			
			if(hasErrors){
				return null;
			}
			return processor.processData(resultData);
		});
	};
	
	CAR3Workflow.prototype.calculateForecast = function(processor, payload){
		return Models.getForecast(cleanCAR3Payload(payload)).then(function(data){
			var resultData = data.data;
			var responses = Utils.get(data, ["returnedData", "__batchResponses"]) || [];
			var hasErrors = responses.map(function(res){
				var body = Utils.get(res, ["response", "body"]);
				return body && body.indexOf("error") > -1;
			}).reduce(function(a, b) { return a || b; }, false);
			
			
			if(hasErrors){
				return null;
			}
			return processor.processData(resultData);
		});
	};
	
	CAR3Workflow.prototype.detectCollisions = function(processor, payload){
		return Models.getCollision(cleanCAR3Payload(payload));
	};
	
	
	CAR3Workflow.prototype.determineVendorFunds = function(processor, payload){
		return Models.getVendorFunds(cleanCAR3Payload(payload));
	};
	
	/*
	 * New features: LocationSubgroups
	 * 
	 */
	function CAR4Workflow(){
	}
	
	function fetchOfferData(processor, expands){
		return function(){
			return processor.service.fetchOfferData(expands);
		};
	}
	
	function processData(processor){
		return function(data){
			return processor.processData(data);
		};
	}
	
	CAR4Workflow.prototype.onInit = function(processor){
		var initializeOfferData = pipe(processor, 
				[fetchOfferData(processor, READ_OFFER_EXPANSIONS_NEWFEATURES + ExtensibilityConfig.getExpand()),
				 log("fetched offer data"),
				 processData(processor)]);
		
		var initializeStaticContent = pipe(processor, 
				[processor._fetchStaticData, processor._setStaticData]);
		
		return Promise.all([ initializeOfferData(), initializeStaticContent()]);
	};
	
	
	function cleanPayload(payload) {
		if (Array.isArray(payload.Versions)) {
			(payload.Versions || []).forEach(function(version){
				delete version.LocationSubgroups;
				cleanCurrencyListPayload(version);
			});
		}
		cleanUoMsPayload(payload);
		cleanCurrencyListPayload(payload);
		return payload;
	};
	
	CAR4Workflow.prototype.saveOffer = function(processor, payload){
		return processor.service.saveOffer(cleanPayload(payload), READ_OFFER_EXPANSIONS_NEWFEATURES + ExtensibilityConfig.getExpand());
	};
	
	CAR4Workflow.prototype.calculateFinancials = function(processor, payload){
		return Models.getFinancials(cleanPayload(payload)).then(function(data) {
			
			var resultData = data.data;
			var responses = Utils.get(data, ["returnedData", "__batchResponses"]) || [];
			var hasErrors = responses.map(function(res){
				var body = Utils.get(res, ["response", "body"]);
				return body && body.indexOf("error") > -1;
			}).reduce(function(a, b) { return a || b; }, false);
			
			if(hasErrors){
				return null;
			}
			return processor.processData(resultData);
		});
	};
	
	CAR4Workflow.prototype.calculateForecast = function(processor, payload){
		return Models.getForecast(cleanPayload(payload)).then(function(data){
			var resultData = data.data;
			var responses = Utils.get(data, ["returnedData", "__batchResponses"]) || [];
			var hasErrors = responses.map(function(res){
				var body = Utils.get(res, ["response", "body"]);
				return body && body.indexOf("error") > -1;
			}).reduce(function(a, b) { return a || b; }, false);
			
			if(hasErrors){
				return null;
			}
			return processor.processData(resultData);
		});
	};
	
	CAR4Workflow.prototype.detectCollisions = function(processor, payload){
		return Models.getCollision(cleanPayload(payload));
	};
	
	
	CAR4Workflow.prototype.determineVendorFunds = function(processor, payload){
		return Models.getVendorFunds(cleanPayload(payload));
	};
	
	function CAR2Workflow(){}
	
	function convertCAR1UoMToCAR3UoM(uoms){
		return uoms.map(function(uom){
			return {
				Unit : uom.Id
			};
		});
	}
	
	var itemId = Utils.prop("Id");
	
	
	function mergeProductDetails(offerDetails, serviceDetails){
		var serviceDetailsIndex = Utils.indexBy(itemId, serviceDetails);
		for(var i = 0, l = offerDetails.length; i < l; i++){
			var offerDetail = offerDetails[i];
			var serviceDetail = Utils.first(serviceDetailsIndex[offerDetail.ProductId]);
			if(!serviceDetail){
				continue;
			}
			offerDetail.UoMs = {
				results : convertCAR1UoMToCAR3UoM(serviceDetail.UnitOfMeasures.results)
			};
			
			offerDetail.Description = serviceDetail.Name;
		}
	}
	
	function car200OfferTerms(data){
		var terms = Utils.get(data, ["Terms", "results"]) || [];
		var termData = (terms || []).map(function(term){
			if (!Utils.isInitial(term.ProductId)) {
				return [term.ProductId, term.DimensionType];
			} else if (!Utils.isInitial(term.HierarchyNodeId)) {
				return [term.HierarchyNodeId, term.DimensionType];
			} else {
				return [term.HierarchyId, term.DimensionType];
			}
		}).map(function(termCallData){
			return Models.getProductById.apply(Models, termCallData);
		});
		
		
		
		return Promise.all(termData).then(function(result){
			for(var i = 0, l = terms.length; i < l; i++){
				var offerTerm = terms[i];
				var serviceTerm = result[i];
				
				var serviceUoM = serviceTerm.UnitOfMeasures.results;
				offerTerm.UoMs = {
					results : convertCAR1UoMToCAR3UoM(serviceUoM)
				};
				offerTerm.Description = serviceTerm.Name;
				
				if(offerTerm.DimensionType === "01") {
					offerTerm.TermProducts.results[0].UoMs = offerTerm.UoMs; 
					offerTerm.TermProducts.results[0].Description = offerTerm.Description;
				}else if(offerTerm.TermProducts && offerTerm.TermProducts.results){
					mergeProductDetails(offerTerm.TermProducts.results, serviceTerm.Children.results);
				}
			}
			
			return data;
		});
	}
	
	function car200OfferData(data){
		var unwrappedData = Utils.get(data, ["data", "data"]) || Utils.get(data, ["data"]);
		var offer = car200OfferTerms(unwrappedData);
		var versionData = (Utils.get(data, ["data", "Versions", "results"]) || []).map(car200OfferTerms);
		return Promise.all([offer].concat(versionData)).then(function(){
			return data;
		});
	}
	
	function car200FetchOfferData(processor, expands){
		return function(){
			var offerData = fetchOfferData(processor, expands)();
			return offerData.then(car200OfferData);
		};
	}
	
	CAR2Workflow.prototype.initializeOfferData = function(processor){
		var initializeOfferData = pipe(processor, 
				[car200FetchOfferData(processor, READ_OFFER_EXPANSIONS_CAR200 + ExtensibilityConfig.getExpand()),
				 log("fetched offer data"),
				 processData(processor)]);
		
		return initializeOfferData();
	};
	
	CAR2Workflow.prototype.onInit = function(processor){
		var initializeStaticContent = pipe(processor, 
				[processor._fetchStaticData, processor._setStaticData]);
		
		return Promise.all([ this.initializeOfferData(processor), initializeStaticContent()]);
	};
	
	function car200StripPayload(payload){
		var terms = payload.Terms;
		var i = 0;
		if(terms){
			for(i = 0; i < terms.length; i++){
				terms[i].UoMs = undefined;
				terms[i].Description = undefined;
				var termProducts = terms[i].TermProducts;
				if(termProducts){
					for(var j = 0, tp = termProducts.length; j < tp; j++){
						termProducts[j].UoMs = undefined;
						termProducts[j].Description = undefined;
					}
				}
			}
		}
		
		if(payload.Versions){
			for(i = 0; i < payload.Versions.length; i++){
				payload.Versions[i] = car200StripPayload(payload.Versions[i]);
			}
		}
		
		return payload;
	}
	
	CAR2Workflow.prototype.saveOffer = function(processor, payload){
		return processor.service.saveOffer(car200StripPayload(payload)).then(car200OfferData);
	};
	
	CAR2Workflow.prototype.determineVendorFunds = function(processor, payload){
		return Models.getVendorFunds(car200StripPayload(payload)).then(car200OfferData);
	};
	
	CAR2Workflow.prototype.calculateFinancials = function(processor, payload){
		return Models.getFinancials(car200StripPayload(payload)).then(car200OfferData).then(function(data) {
			
			var resultData = data.data;
			var responses = Utils.get(data, ["returnedData", "__batchResponses"]) || [];
			var hasErrors = responses.map(function(res){
				var body = Utils.get(res, ["response", "body"]);
				return body && body.indexOf("error") > -1;
			}).reduce(function(a, b) { return a || b; }, false);
			
			if(hasErrors){
				return null;
			}
			return processor.processData(resultData);
		});
	};
	
	CAR2Workflow.prototype.calculateForecast = function(processor, payload){
		return Models.getForecast(car200StripPayload(payload)).then(car200OfferData).then(function(data){
			var resultData = data.data;
			var responses = Utils.get(data, ["returnedData", "__batchResponses"]) || [];
			var hasErrors = responses.map(function(res){
				var body = Utils.get(res, ["response", "body"]);
				return body && body.indexOf("error") > -1;
			}).reduce(function(a, b) { return a || b; }, false);
			
			if(hasErrors){
				return null;
			}
			return processor.processData(resultData);
		});
	};
	
	CAR2Workflow.prototype.detectCollisions = function(processor, payload){
		return Models.getCollision(car200StripPayload(payload));
	};
	
	
	function CommunicationProcessor(appState, service, offerDataProvider){
		this.appState = appState;
		this.service = service;
		this.offerDataProvider = offerDataProvider;
		this.workflow = appState.workflow || new CAR3Workflow();
		this.staticData = null;
		this.offerData = null;
		this.snapshot = appState.transientSnapshot;
	}
	
	
	CommunicationProcessor.prototype.getStaticData = function(){
		return this.staticData;
	};
	
	CommunicationProcessor.prototype.getOfferData = function(){
		return this.offerData;
	};
	
	CommunicationProcessor.prototype.getHeaders = function(){
		return this.headers;
	};

	CommunicationProcessor.prototype.onInit = function(done){
		done = done || jQuery.noop;
		var that = this;
		return new Promise(function(resolve, reject){
			Models.getMetadataAnalyzer().then(function(result){
				var schemaDefinition = result.getSchemaDefinition();
				var version = schemaDefinition["sap:schema-version"];
				Utils.setSchemaVersion(parseInt(version, 10));
				//initial workflow is set to CAR3.0 workflow.
				// if the version is newer then use CAR4
				if(parseInt(version, 10) >= 2) {
					that.workflow = new CAR4Workflow();
					// set to use feature UIState instead of Status
					Utils.setStatusField("UIState");
				} else {
					// set to use Status for old version
					Utils.setStatusField("Status");
				}
				that.appState.workflow = that.workflow;
				
				return resolve(that.workflow.onInit(that).then(null, function(error){
					// if version fails, retry with CAR2.0 workflow.
					//when CAR2.0 fails, initial load fails as well.
					that.workflow = new CAR2Workflow();
					that.appState.workflow = that.workflow;
					Utils.setStatusField("Status");
					//ODataModel pushes errors to the message manager on fail.
					//but for this case we don't what that message there. 
					Utils.getMessageManager().removeAllMessages();
					//retry with the next workflow
					return that.workflow.onInit(that);
				}).then(function(result){
					return Promise.resolve(done());
				}).then(function(result){
					that.snapshot = that.createSavePayload();
				}));
			});
		});
		
	};
	
	CommunicationProcessor.prototype._processUserProjections = function(offerData){
		addServerUserProjection(offerData);
		(offerData.Versions || []).forEach(addServerUserProjection);
		return offerData;
	};
	
	CommunicationProcessor.prototype.processData = function(content){
		var dataProcessor = pipe(this, 
				[this._storeHeaders,
				 log("stored headers"),
				 replaceInitialWithNull,
				 log("replaced initial with null"),
				 this._stripMetadata,
				 log("strip the metadata"),
				 this._processCollectionObjects,
				 log("unwrap collections and strip defered objects"),
				 this._setupOfferInitalRange,
				 log("setup offer range"),
				 this._setupMasterDataSystem,
				 log("setup master data system"),
				 this._processUserProjections,
				 this._setDefaultValues,
				 this._setOfferData]);
		return dataProcessor(content);
	};
	
	var process = (function(){
		var executor = {
			processObject : function processObject(object){
				if(jQuery.isArray(object)){
					return;
				}else if(typeof object === "object"){
					this.process(object);
				}
			},
			processCollection : function processCollection(collection){
				var unwrapped = unwrapCollection(collection);
				for(var i = 0; i < unwrapped.length; i++){
					this.process(unwrapped[i]);
				}
				return unwrapped;
			},
			process : function process(data){
				for(var key in data){
					if(data.hasOwnProperty(key)){
						if(isDeferdObject(data[key])){
							delete data[key];
						}else if(isWrappedCollection(data[key])){
							data[key] = this.processCollection(data[key]);
						} else {
							this.processObject(data[key]);
						}
					}
				}
				return data;
			}
		};
		return executor.process.bind(executor);
	}());
	
	
	
	CommunicationProcessor.prototype._processCollectionObjects = function(data){
		return process(data);
	};
	
	CommunicationProcessor.prototype._stripMetadata = function(data){
		if(!data){
			return data;
		}
		if(data.hasOwnProperty("__metadata")){
			delete data.__metadata;
		}
		
		if(jQuery.isArray(data)){
			for(var i = 0; i < data.length; i++){
				this._stripMetadata(data[i]);
			}
		}else if(typeof data === "object"){
			for(var key in data){
				if(data.hasOwnProperty(key)){
					this._stripMetadata(data[key]);
				}
			}
		}
		
		return data;
	};
	
	CommunicationProcessor.prototype._setupOfferInitalRange = function(data){
		var start = data.StartOfOffer;
		var end = data.EndOfOffer;
		if(start){
			start = Utils.getFormatedDateForRead(start);
		}else{
			start = getStartOfToday();
		}
		
		if(end){
			end = Utils.getFormatedDateForRead(end);
		}else{
			end = getEndOfToday();
		}
		
		data.StartOfOffer = start;
		data.EndOfOffer = end;
		
		if(data.Tactics){
			data.Tactics.forEach(function(t){
				t.StartOfTactic = Utils.getFormatedDateForRead(t.StartOfTactic);
				t.EndOfTactic = Utils.getFormatedDateForRead(t.EndOfTactic);
			});
		}
		
		if(data.Versions){
			data.Versions.forEach(function(v){
				this._setupOfferInitalRange(v);
			}, this);
		}
		
		return data;
	};
	
	CommunicationProcessor.prototype._setupMasterDataSystem = function(data){
		var currentSystem = data.MasterdataSystem;
		if(currentSystem){
			return data;
		}
		return this.service.getMasterDataSystem().then(function(system){
			data.MasterdataSystem = system;
			return data;
		});
	};
	
	CommunicationProcessor.prototype._setDefaultValues = function(data){
		data.TargetGroups = data.TargetGroups || [];
		data.Attributes = data.Attributes || [];
		data.LocationHierarchy = data.LocationHierarchy || [];
		data.LocationHierarchy.forEach(function(l){
			l.Locations = l.Locations || [];
		});
		return data;
	};
	
	CommunicationProcessor.prototype._storeHeaders = function(data){
		if (data && data.response) {
			this.headers = data.response.headers;			
			return data.data;
		}
		if(data) {
			return data.data;
		}
		return null;
	};
	
	CommunicationProcessor.prototype._setOfferData = function(offerData){
		this.offerData = clone(offerData);
		return offerData;
	};
	
	CommunicationProcessor.prototype.setOfferDataProvider = function(offerDataProvider){
		 this.offerDataProvider = offerDataProvider;
	};
	
	CommunicationProcessor.prototype._fetchStaticData = function(){
		return this.service.fetchStaticContent();
		
	};
	CommunicationProcessor.prototype._setStaticData = function(staticData){
		this.staticData = staticData;
	};
	

	CommunicationProcessor.prototype._updateProductDetailsUserProjection = function(savePayload){
		var terms = savePayload.Terms;
		if(terms){
			for(var i = 0, tl = terms.length; i < tl; i++){
				var productDetails = terms[i].TermProducts;
				if(!productDetails){
					continue;
				}
				
				for(var j = 0, pl = productDetails.length; j < pl; j++){
					var pd = productDetails[j];
					var serverUserProjection = pd.ServerUserProjection;
					var userProjection = pd.UserProjection;
					var userProjectionLock = pd.LockUserProjection;
					
					if(parseFloat(userProjection) && userProjection !== serverUserProjection) {
						pd.LockUserProjection = true;
					} else if(userProjection === serverUserProjection && !userProjectionLock){
						userProjection = "0";
					}
					delete pd.ServerUserProjection;
					pd.UserProjection = userProjection;
				}
				
			}
		}

		if(savePayload.Versions){
			for(var i = 0, vl = savePayload.Versions.length; i < vl; i++){
				savePayload.Versions[i] = this._updateProductDetailsUserProjection(savePayload.Versions[i]);
			}
		}
		
		return savePayload;
	};
	
	CommunicationProcessor.prototype.createSavePayloadWithFinancials = function(){
		var payload = this.offerDataProvider.getOfferWithFinancials();
		return stripEmpty(clone(payload));
	};
	
	CommunicationProcessor.prototype.createSavePayload = function(){
		var payload = this.offerDataProvider.getOfferData();
		return this._updateProductDetailsUserProjection(stripEmpty(processDates(clone(payload))));
	};
	
	CommunicationProcessor.prototype.storeSnapshot = function(offerData){
		this.snapshot = offerData;
	};
	
	CommunicationProcessor.prototype.getSnapshot = function(){
		return this.snapshot;
	};

	CommunicationProcessor.prototype.hasChanges = function(){
		return !jQuery.sap.equal(this.snapshot, this.createSavePayload());
	};
	
	
	CommunicationProcessor.prototype.saveOffer = function(){
		var payload = this.createSavePayload();
		return this.workflow.saveOffer(this, payload);
	};
	
	CommunicationProcessor.prototype.calculateFinancials = function(payload){
		return this.workflow.calculateFinancials(this, payload);
	};
	
	CommunicationProcessor.prototype.determineVendorFunds = function(payload){
		return this.workflow.determineVendorFunds(this, payload);
	};
	
	CommunicationProcessor.prototype.calculateForecast = function(payload){
		return this.workflow.calculateForecast(this, payload);
	};
	
	CommunicationProcessor.prototype.detectCollisions = function(payload){
		return this.workflow.detectCollisions(this, payload);
	};
	
	return CommunicationProcessor;
}, true);