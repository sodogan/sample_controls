/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui
		.define(
				[
						"retail/pmr/promotionaloffers/plugins/terms/TermsBaseController",
						"retail/pmr/promotionaloffers/plugins/terms/styles/FreestyleDataTypes",
						"sap/ui/model/json/JSONModel",
						"sap/ui/core/Fragment",
						"retail/pmr/promotionaloffers/plugins/terms/controls/freestyle/ProductDetailsOperations",
						"retail/pmr/promotionaloffers/plugins/terms/controls/freestyle/ProductDetailsMassChange",
						"retail/pmr/promotionaloffers/utils/Models",
						"retail/pmr/promotionaloffers/utils/Utils",
						"retail/pmr/promotionaloffers/plugins/terms/styles/ProductController", 
						"retail/pmr/promotionaloffers/plugins/terms/styles/ProductGroupController",
						"retail/pmr/promotionaloffers/plugins/terms/styles/ProductHierarchyController",
						"retail/pmr/promotionaloffers/plugins/terms/styles/GenericProductController",
						"retail/pmr/promotionaloffers/plugins/terms/styles/FreestyleViewFormatters",
						"retail/pmr/promotionaloffers/utils/ForecastDialog",
						"retail/pmr/promotionaloffers/utils/FinancialCalculations"],
				function(TermsBaseController, Types, JSONModel,
						Fragment, ProductDetailsOperations, ProductDetailsMassChange, 
						Models, Utils, ProductController, ProductGroupController, 
						ProductHierarchyController, GenericProductController, FreestyleViewFormatters,
						ForecastDialog, Calculator) {
					
					function refreshModel(model, bEnforceRefresh) {
						if (Models.isModelRefreshPostponed() && !bEnforceRefresh) {
							return;
						}
						jQuery.sap.delayedCall(0, null, function () {
							model.refresh(true);
						});
					}
					
					function objectFromElement(e, contextName) {
						return !e ? null : e.getBindingContext(contextName)
								.getObject();
					}

					function objectFromEvent(e) {
						return objectFromElement(e.getSource());
					}

					function getTerms(model) {
						return model.getData().Terms;
					}

					function getRewards(model) {
						return model.getData().Rewards;
					}

					function clearTerm(term, shouldClearConditions) {
						term.Conditions = shouldClearConditions ? []
								: term.Conditions;

						term.Selection.ProductId = null;
						term.Selection.HierarchyId = null;
						term.Selection.HierarchyNodeId = null;
						term.Selection.UnitOfMeasure = null;
						term.Selection.Quantity = null;
						term.Selection.MinAmount = null;
						term.Selection.UserProjection = null;
						term.Selection.PromoCostPrice = null;
						term.Selection.PromoCostPriceCurrency = null;
						term.ProductTextValue = null;
						term.ProductDescriptionValue = null;
						term.Selection.Products = 0;
						
					}

					function clearReward(reward, shouldClearIncentives) {
						if(!reward) {
							return;
						}
						reward.Incentives = shouldClearIncentives ? [] : reward.Incentives;
						if (reward.Selection.ProductId) { 
							reward.Selection.ProductId = null;
						}
						if (reward.Selection.HierarchyId) { 
							reward.Selection.HierarchyId = null;
						}
						if (reward.Selection.HierarchyNodeId) { 
							reward.Selection.HierarchyNodeId = null;
						}
						if (reward.Selection.UnitOfMeasure) { 
							reward.Selection.UnitOfMeasure = null;
						}
						if (reward.Selection.DiscountType) { 
							reward.Selection.DiscountType = null;
						}
						if (reward.Selection.DiscountValue) { 
							reward.Selection.DiscountValue = null;
						}
						if (reward.Selection.SubDiscountValue) { 
							reward.Selection.SubDiscountValue = null;
						}
						if (reward.Selection.Products) { 
							reward.Selection.Products = 0;
						}
						
						if(reward.ForTerm){
							reward.ForTerm.DiscountTypeLabel = null;
							reward.ForTerm.DiscountValue = null;
							reward.ForTerm.SubDiscountValue = null;
						}
						
						reward.Type = "";
						reward.ProductTextValue = null;
						reward.ProductDescriptionValue = null;

					}

					function setSelectionOnTerm(term, selection) {
						if (selection) {
							term.Selection = selection;
						}

						if (!selection) {
							clearTerm(term, true);
						}

						if (selection && selection.hasOwnProperty("Type")) {
							clearTerm(term);
							term.Selection.DimensionType = selection.DimensionType;
							term.Type = selection.Type;
						}
					}

					function setSelectionOnReward(reward, selection) {
						/*
						 * if (selection) { reward.Selection = selection; }
						 */

						if (!selection) {
							clearReward(reward, true);
						}

						if (selection && selection.hasOwnProperty("Type")) {
							clearReward(reward);
							reward.Type = selection.Type;
							reward.TermType = "2";
							reward.Selection.DimensionType = selection.DimensionType;
							reward.Selection.DiscountAssignment = selection.DiscountAssignment
									|| "0";
							reward.Selection.Variety = selection.Variety || "0";

						}
						// Apply configs
						var confProp = Object.keys(reward.ProductConfig || {});
						confProp.forEach(function(property) {
							if (reward.Selection.hasOwnProperty(property)) {
								reward.Selection[property] = (reward.ProductConfig[property] || {}).DefaultValue;
							}
						});
					}
					
					function computeRewardOptions(reward, type, rewardOptions, isPackageOffer) {
						// some helpers

						// compose function with '&&' between them
						function and(/* ...args */) {
							var args = Array.prototype.splice.call(arguments, 0);
							return args.reduce(function(a, b) {
								return function(x) {
									return a(x) && b(x);
								};
							}, Utils.identity);
						}
						// check that option is not given type
						function isNot(type) {
							return function(option) {
								return option.Type !== type;
							};
						}

						// various checks
						var isADiscount = and(isNot("02"), isNot("03"));
						var isProductAtDiscount = and(isNot("01"),
								isNot("03"));
						var isAppropriation = and(isNot("01"), isNot("02"));
						var isIncentive = and(isNot("01"), isNot("02"),
								isNot("03"));

						// actual filtering logic
						function optionsFilter(termType, packageOffer) {
							return function(rewardOption) {
								if (termType === "ForTerm") {
									if (packageOffer) {
										return isAppropriation(rewardOption);
									} else {
										return isADiscount(rewardOption);
									}
								} else if (termType === "WholeOffer" || termType === "InsteadOf") {
									if (packageOffer) {
										return isIncentive(rewardOption);
									} else {
										return isProductAtDiscount(rewardOption);
									}
								} else {
									return false; // keep everything
								}
							};
						}
						reward.RewardOptions = rewardOptions.filter(optionsFilter(type, isPackageOffer));

					}

					function setupIndentifiers(terms) {
						var changes = [];
						for (var i = 0; i < terms.length; i++) {
							var oldTermObject = jQuery.sap.extend({}, terms[i]);

							terms[i].Identifier = (i + 1) + "";
							var newTermObject = terms[i];

							changes.push({
								oldTerm : oldTermObject,
								newTerm : newTermObject
							});
						}

						return changes;

					}

					function setupOperatorLabel(terms, label) {
						terms.forEach(function(term, index) {
							term.OperatorLabel = index > 0 ? label + " " : "";
						});
					}

					function removeTerm(terms, termObject) {
						if (terms.length === 1) {
							setSelectionOnTerm(termObject, null);
						} else {
							terms.splice(terms.indexOf(termObject), 1);
						}
					}

					function removeReward(rewards, rewardObject) {
						if (rewards.length === 1) {
							setSelectionOnReward(rewardObject, null);
						} else {
							rewards.splice(rewards.indexOf(rewardObject), 1);
						}
					}

					function addTerm(terms, textFn, oTermTemplate) {
						var newIdentifier = terms.length + 1;
						
						if(!oTermTemplate){
							var term = new Types.Term(newIdentifier + "");
							term.DimensionTypeText = textFn("CreateOffer.Terms.FreestyleOffer.Product");
							term.More = {
								Visible : false
							};
	
							term.Type = "01";
							term.Selection = {
								DimensionType : "01"
							};
						}else{
							term = jQuery.extend(true, {}, oTermTemplate);
							term.Identifier = newIdentifier + "";
						}
						terms.push(term);
						return term;
					}

					function addReward(rewards, textFn, oRewardTemplate) {
						var newIdentifier = rewards.length + 1;
						
						var reward = new Types.Reward(rewards.length + 1);
						reward.Selection.DimensionType = "01";
						reward.TermType = "2";
						reward.DimensionTypeText = textFn("CreateOffer.Terms.FreestyleOffer.Product");
						reward.More = {
							Visible : false
						};
						if(oRewardTemplate){
							var oReward = jQuery.extend(true, {}, oRewardTemplate);		
							
							reward.RewardOptions = oReward.RewardOptions;
							reward.ProductConfig = oReward.ProductConfig;
							reward.SectionConfig = oReward.SectionConfig;
						}
						rewards.push(reward);
						return reward;
					}

					function clearApplicabilities(rewards) {
						for (var i = 0; i < rewards.length; i++) {
							rewards[i].Applicabilities = [];
						}
					}

					function computeInsteadOfApplicabilities(rewards,
							resourceBundle) {
						for (var i = 0; i < rewards.length; i++) {
							for (var j = 0; j < rewards.length; j++) {
								if (rewards[i] === rewards[j]) {
									continue;
								}

								if ((rewards[j].isWholeOffer && rewards[j].Type === "02")
										|| rewards[j].LinkedReward) {
									var id = rewards[i].Applicabilities.length;

									var text = "";

									if (resourceBundle) {
										text = jQuery.sap
												.formatMessage(
														resourceBundle
																.getProperty("CreateOffer.Terms.FreestyleOffer.InsteadOfReward"),
														rewards[j].Identifier);
									}

									rewards[i].Applicabilities
											.push(new Types.RewardApplicabilityInsteadOf(
													id, text, rewards[j]));
								}
							}
						}
					}

					function computeForTermApplicabilities(rewards, terms, resourceBundle) {
						
						var baseText = resourceBundle ? resourceBundle.getProperty("CreateOffer.Terms.FreestyleOffer.ForTerm") : "";
						for (var i = 0; i < rewards.length; i++) {
							for (var j = 0; j < terms.length; j++) {
								var id = rewards[i].Applicabilities.length;

								var text = "";

								if (resourceBundle) {
									text = jQuery.sap.formatMessage(baseText ,terms[j].Identifier);
								}

								rewards[i].Applicabilities.push(new Types.RewardApplicabilityForTerm(id, text, terms[j]));
							}
						}
					}

					function computeForWholeOfferApplicabilities(rewards,resourceBundle) {
						if (resourceBundle) {
							var text = resourceBundle.getProperty("CreateOffer.Terms.FreestyleOffer.ForWholeOffer");
						}
						for (var i = 0; i < rewards.length; i++) {
							var id = rewards[i].Applicabilities.length;
							rewards[i].Applicabilities.push(new Types.RewardApplicabilityWholeOffer(id, text));
						}
					}
					
					function findCorrectAplicabilitity(reward) {
						var applicabilities = reward.Applicabilities;
						var term = reward.ForTerm;
						var isWholeOffer = reward.isWholeOffer;

						if (isWholeOffer) {
							if(reward.Operation === "2") {
								applicabilities = applicabilities.filter(isInsteadOfApplicabilitity);
							} else {
								applicabilities = applicabilities.filter(isWholeOfferApplicabilitity);
							}
						} else {
							applicabilities = applicabilities.filter(isApplicabitityWithTerm(term));
						}
						var applicabilityId = applicabilities.map(getApplicabilitityId)[0];
						if(!jQuery.isNumeric(applicabilityId)) {
							return null;
						}
						return applicabilityId + "";
						
					}

					function calculateRewardApplicabilities(rewards, terms, resourceBundle) {
						clearApplicabilities(rewards);
						computeForTermApplicabilities(rewards, terms, resourceBundle);
						computeForWholeOfferApplicabilities(rewards, resourceBundle);
						computeInsteadOfApplicabilities(rewards, resourceBundle);
						rewards.forEach(function(reward) {
							var applicabilityId = findCorrectAplicabilitity(reward);
							reward.Applicability = applicabilityId;
							if(applicabilityId) {
								reward.ApplicabilityName = reward.Applicabilities[applicabilityId].Name;
							}
						});
					}

					function setupLinksBetweenTermAndReward(reward, selection) {
						if(!reward){
							return;
						}
						var term = selection ? selection.Term : null;
						if (term) {
							reward.ForTerm = term;
							reward.isWholeOffer = false;
						} else {
							reward.ForTerm = null;
							reward.isWholeOffer = true;
						}
					}

					function setupLinksBetweenRewards(reward, selection) {
						var linkedReward = selection ? selection.Reward : null;
						if (linkedReward) {
							linkedReward.InsteadOfLinkedReward = reward;
							reward.LinkedReward = linkedReward;
							reward.isWholeOffer = true;
						} else {
							if (reward.LinkedReward) {
								reward.LinkedReward.InsteadOfLinkedReward = null;
								reward.LinkedReward = null;
							}
						}
					}

					function clearErrors(rewards, terms) {
						terms = terms || [];
						rewards = rewards || [];
						for (var i = 0; i < rewards.length; i++) {
							rewards[i].Error = null;
						}
						for (var j = 0; j < terms.length; j++) {
							terms[j].ProductIdError = null;
							terms[j].QuantityError = null;
						}
					}

					function markErrorsMissingProduct(terms) {
						terms = terms || [];
						terms.forEach(function(term) {
							if (term.Selection.DimensionType === "01"
									&& !term.Selection.ProductId) {
								term.ProductIdError = "Error";
							}
							if (term.Selection.DimensionType === "02"
									&& !term.Selection.HierarchyId
									&& !term.Selection.HierarchyNodeId) {
								term.ProductIdError = "Error";
							}
							if (term.Selection.DimensionType === "03"
									&& !term.Selection.HierarchyId
									&& !term.Selection.HierarchyNodeId) {
								term.ProductIdError = "Error";
							}
							if (!term.Quantity) {
								term.QuantityError = "Error";
							}
						});
					}

					function markErrorsCausedByMixedAndOrReward(rewards) {
						function incorrectState(rewards) {
							var isIncorrectState = false;
							var wholeOfferRewards = 0;
							var insteadOfRewards = 0;

							rewards.forEach(function(reward) {
								if (reward.isWholeOffer && !reward.LinkedReward) {
									wholeOfferRewards++;
								}
								if (reward.LinkedReward) {
									insteadOfRewards++;
								}
							});

							if (wholeOfferRewards > 1 && insteadOfRewards > 0) {
								isIncorrectState = true;
							}

							return isIncorrectState;
						}

						if (incorrectState(rewards)) {
							rewards = rewards
									.map(function(reward) {
										if (reward.isWholeOffer
												|| reward.LinkedReward) {
											reward.Error = "Error";
										}

										return reward;
									});
						}
					}

					function markErrorsCausedByDuplicateForTerm(rewards) {
						for (var i = 0; i < rewards.length; i++) {

							if (!rewards[i].ForTerm) {
								continue;
							}
							for (var j = 0; j < rewards.length; j++) {
								if (rewards[i] === rewards[j]
										|| !rewards[j].ForTerm) {
									continue;
								}
								if (rewards[i].ForTerm === rewards[j].ForTerm) {
									rewards[j].Error = "Error";
									rewards[i].Error = "Error";
								}
							}
						}
					}
					function markErrorsCausedByDuplicateForInsteadOf(rewards) {
						for (var i = 0; i < rewards.length; i++) {
							for (var j = 0; j < rewards.length; j++) {
								if (rewards[i] === rewards[j]) {
									continue;
								}
								if (rewards[i].LinkedReward
										&& rewards[i].LinkedReward === rewards[j].LinkedReward) {
									rewards[j].Error = "Error";
									rewards[i].Error = "Error";
								}
							}
						}
					}

					function markErrorsCausedByTermRemoval(rewards, termObject) {
						for (var i = 0; i < rewards.length; i++) {
							if (rewards[i].ForTerm === termObject) {
								rewards[i].Error = "Error";
								rewards[i].ForTerm = null;
								rewards[i].Applicability = null;
							}
						}
					}

					function markErrorsCausedByRewardRemoval(rewards,
							rewardObject) {
						for (var i = 0; i < rewards.length; i++) {
							if (rewards[i] === rewardObject.InsteadOfLinkedReward) {
								rewards[i].Error = "Error";
								rewards[i].Applicability = null;
							}
						}
					}

					function markErrorsMissingProductInInsteadOf(rewards) {
						rewards.forEach(function(reward) {
							if (reward.LinkedReward && reward.Type !== "02") {
								reward.Error = "Error";
							}
						});
					}

					function markErrorsInvalidReward(rewards) {
						rewards.forEach(function(reward) {
							if (!reward.Applicability) {
								reward.Error = "Error";
							} else if(!reward.Applicabilities[reward.Applicability]){
								reward.Error = "Error";
							}
						});
					}

					function markErrors(rewards, termObject, rewardObject, terms) {
						markErrorsCausedByDuplicateForTerm(rewards);
						markErrorsCausedByDuplicateForInsteadOf(rewards);
						markErrorsCausedByMixedAndOrReward(rewards);
						markErrorsMissingProduct(terms);
						markErrorsMissingProductInInsteadOf(rewards);
						markErrorsInvalidReward(rewards);
						if (termObject) {
							markErrorsCausedByTermRemoval(rewards, termObject);
						}
						if (rewardObject) {
							markErrorsCausedByRewardRemoval(rewards,
									rewardObject);
						}
					}

					function removeDuplicates(array) {
						function isInArray(array, item) {
							return array.some(function(element) {
								return element.Class === item.Class;
							});
						}

						var newArray = [];

						array.forEach(function(item) {
							if (!isInArray(newArray, item)) {
								newArray.push(item);
							}
						});

						return newArray;
					}

					/**
					 * Returns true if given item is the last item in an array
					 * 
					 * @param {array}
					 *            items - array of items
					 * @param {any}
					 *            item - item in the array
					 * @return {boolean} - true if the item is the last item in
					 *         given array
					 */
					function isLastItem(items, item) {
						var currentItemIndex = items.indexOf(item);
						return currentItemIndex === (items.length - 1);
					}

					function mapDimTypeToDimText(dimType, dimensions) {
						dimensions = dimensions || [];

						var dim = dimensions.filter(function(dim) {
							return dim.Key === dimType;
						})[0] || {};

						return dim.Value;
					}

					function mapDiscountTypeToDiscountLabel(discType, types) {
						types = types || [];

						var discount = types.filter(function(dis) {
							return dis.Key === discType;
						})[0] || {};

						return discount.Value;
					}

					function createBlankTerm(id, textFn) {
						var term = new Types.Term(id);
						term.Type = "01";
						term.Selection.DimensionType = "01";
						term.Selection.UserProjection = null;
						term.DimensionTypeText = textFn("CreateOffer.Terms.FreestyleOffer.Product");
						term.More = {
							Visible : false
						};
						return term;
					}

					function createApplicabilitiesForReward(terms, textFn) {
						var applicabilities = terms
								.map(function(term, index) {
									var text = jQuery.sap
											.formatMessage(
													textFn("CreateOffer.Terms.FreestyleOffer.ForTerm"),
													term.Identifier);
									return new Types.RewardApplicabilityForTerm(
											index, text, term);
								});
						applicabilities
								.push(new Types.RewardApplicabilityWholeOffer(
										applicabilities.length,
										textFn("CreateOffer.Terms.FreestyleOffer.ForWholeOffer")));
						return applicabilities;
					}

					function createBlankReward(id, textFn) {
						var reward = new Types.Reward(id, [], []);

						reward.Selection.DimensionType = "01";
						reward.DimensionTypeText = textFn("CreateOffer.Terms.FreestyleOffer.Product");
						reward.More = {
							Visible : false
						};
						return reward;
					}

					function createBlankCondition(conditions, possibleSubs,
							clazz) {

						function byClass(i) {
							return i.Class === clazz;
						}

						var cond = jQuery.extend(true, {}, conditions
								.filter(byClass)[0]);

						cond.SubConditions = possibleSubs.filter(byClass);
						cond.More = {
							Visible : false
						};

						return cond;
					}

					function createBlankIncentive(conditions, possibleSubs,
							clazz) {

						function byClass(i) {
							return i.Class === clazz;
						}

						var cond = jQuery.extend(true, {}, conditions
								.filter(byClass)[0]);
						cond.More = {
							Visible : false
						};

						cond.SubIncentives = possibleSubs.filter(byClass);

						return cond;
					}

					function getApplicabilitityId(a) {
						return a.Id;
					}

					function isWholeOfferApplicabilitity(a) {
						return a instanceof Types.RewardApplicabilityWholeOffer;
					}
					function isInsteadOfApplicabilitity(a) {
						return a instanceof Types.RewardApplicabilityInsteadOf;
					}

					function isApplicabitityWithTerm(term) {
						return function(a) {
							return a.Term === term;
						};
					}

					
					/*
					 * Package Offer Distribution logic
					 */
					function convertToTwoDecimals(value){
						var val = parseFloat(value) || 0;
						return  (Math.round(100 * value) / 100);
						
					}
					
					function distributePercentage(values, packagePrice){
						return values.map(function(currValue) {
							if(currValue.Value) {
								currValue.Percentage = (convertToTwoDecimals(currValue.Value) / parseFloat(packagePrice) * 100).toFixed(2);
							}
							return currValue;
						});
					}
					
					function calculateValueDistribution(packagePrice, values){
						
						var valuesWithoutPercentage = values.filter(function(val){

							return val.Percentage === null;
						});
						
						var sum = values.reduce(function(result, currValue) {
							if(currValue.Value) {
								currValue.Value = convertToTwoDecimals(currValue.Value);
																
							} else {
								currValue.Percentage = currValue.Percentage !== null ? convertToTwoDecimals(currValue.Percentage) : null;
								var value = (packagePrice * (currValue.Percentage / 100));
								currValue.Value = convertToTwoDecimals(value);
								result.regPrice += !currValue.Percentage ? parseFloat(currValue.RegularPrice) : 0;
								totalPercentage += currValue.Percentage;
							}
							result.value += currValue.Value;
							return result;
						}, {value: 0, regPrice: 0});
						
						valuesWithoutPercentage.forEach(function(value){
							var val = convertToTwoDecimals((value.RegularPrice / sum.regPrice) * (packagePrice - sum.value));
							var percentage = (val / parseFloat(packagePrice) * 100) || 0;
							
							value.Value = val;
							value.Percentage = convertToTwoDecimals(percentage);
							
						});
						var totalPercentage = values.reduce(function(result, value){
							result.percent += parseFloat(value.Percentage);
							result.value += parseFloat(value.Value);
							return result;
						}, {value: 0, percent: 0});
						
						if(valuesWithoutPercentage.length) {
							var percentage = valuesWithoutPercentage[valuesWithoutPercentage.length - 1].Percentage + (100 - totalPercentage.percent);
							var value = valuesWithoutPercentage[valuesWithoutPercentage.length - 1].Value + (packagePrice - totalPercentage.value);
							
							valuesWithoutPercentage[valuesWithoutPercentage.length - 1].Value = parseFloat(value.toFixed(2));
							valuesWithoutPercentage[valuesWithoutPercentage.length - 1].Percentage = parseFloat(percentage.toFixed(2));
						}
						return values;	
					}
					
					function rewardDiscountValue(reward){
						return reward.Selection.DiscountValue;
					}
					
					function rewardPackageValue(reward){
						return reward.PackageValue;
					}
					
					function extractValues(rewards, totalValue, discountValGetter){
						return rewards.reduce(function(result, reward, index){
							if(reward.isWholeOffer === false && !!reward.ForTerm){
								var discountValue = discountValGetter(reward);
								var discoutPercentage = reward.PercentageValue ? parseFloat(reward.PercentageValue) : null;
								var regularPrice = parseFloat(Utils.get(reward, ["Selection", "Financials", "RegularPrice"]) || 1);
								var quantity =  parseFloat(Utils.get(reward, ["ForTerm", "Selection", "Quantity"]) || 1);
								
								result.push({
									Index : index,
									Value: discountValue ? parseFloat(discountValue) : null,
									Percentage: discoutPercentage > 0 ? parseFloat(discoutPercentage) : null,
									RegularPrice: (regularPrice > 0 ? regularPrice : 1) * quantity
								});
							}
							return result;
						}, []);
					}
					
					function renderValues(model, values, productDetails){
						var rewards = model.getProperty("/Rewards");
						values.forEach(function(value){
							rewards[value.Index].Selection.DiscountValue = value.Value;
							rewards[value.Index].Selection.SubDiscountValue = value.Percentage;
							rewards[value.Index].PackageValue = rewards[value.Index].PackageValue ? value.Value : null;
							rewards[value.Index].PercentageValue = rewards[value.Index].PercentageValue ? value.Percentage : null;
							productDetails.update(rewards[value.Index].ForTerm, "DiscountValue", value.Value);
							productDetails.update(rewards[value.Index].ForTerm, "SubDiscountValue", value.Percentage);
						});
						refreshModel(model);
					}
					var FreestylePrototype = {

						constructor : function() {
							this.data = new JSONModel({});
							this.content = new JSONModel({});
							this.productDetails = new ProductDetailsOperations(this.data);
							this.productController = new ProductController(this.data, this.productDetails);
							this.productGroupController = new ProductGroupController(this.data, this.productDetails);
							this.productHierarchyController = new ProductHierarchyController(this.data, this.productDetails);
							this.genericProductController = new GenericProductController(this.data, this.productDetails, "11");
							this.displayProductController = new GenericProductController(this.data, this.productDetails, "12");

							this.generalModel = null;
						},

						onInit : function() {
							
							this.resourceBundle = Utils.getResourceModel();

							var reward = createBlankReward("1", this.getText
									.bind(this));
							reward.isWholeOffer = true;

							this.data.setData(this.getDefaultTerms([],
									[ reward ], []));

							var terms = getTerms(this.data);

							reward.Applicabilities = createApplicabilitiesForReward(
									terms, this.getText.bind(this));

							var operators = {
								PossibleValues : [
										{
											Key : "1",
											Text : this
													.getText("CreateOffer.Terms.FreestyleOffer.All"),
											TermLevelText : this
													.getText("CreateOffer.Terms.FreestyleOffer.And")
										},
										{
											Key : "2",
											Text : this
													.getText("CreateOffer.Terms.FreestyleOffer.Any"),
											TermLevelText : this
													.getText("CreateOffer.Terms.FreestyleOffer.Or")
										} ]
							};

							this.content.setData({
								TermOptions : [],
								RewardOptions : [],
								Operators : operators
							});

							this.getView().setModel(this.data);
							this.getView().setModel(this.content, "Content");	
						},
						
						afterTermsLoaded : function(){
							jQuery.sap.delayedCall(0, this, function(){
								var editable = this.content.getProperty("/Editable");
								if (editable === false) {
									jQuery("input").css("paddingLeft" , "0px");
								}else{
									jQuery("input").css("paddingLeft" , "");
								}
							});
						},

						isTermSeparatorVisible : function(term) {
							return !isLastItem(getTerms(this.data), term);
						},

						isRewardSeparatorVisible : function(reward) {
							return !isLastItem(getRewards(this.data),
									reward);
						},

						isFinancialSeparatorVisible : function(financial) {
							return !isLastItem(this.data.getData().Financials,
									financial);
						},
						
						handleSort: function(e) {
							var oSmartProductDetailsTable = this.getView().byId("smartProductDetailsTable");
							oSmartProductDetailsTable.sortColumn(e);
						},
						
						showForecast: function(oEvent) {
							var sId = oEvent.getSource().getBindingContext().getProperty("Id");
							var oKey = {
								TermProductId: sId
							};
							ForecastDialog.show(ForecastDialog.Level.Product, oKey, Models.getServiceModel(), Utils.getResourceModel());
						},
						
						/*
						 * Receives two arrays -- terms and rewards. If any of
						 * them are empty it gives back a default one
						 */
						getDefaultTerms : function(terms, rewards, products) {
							var textFn = this.getText.bind(this);

							var term = createBlankTerm("1", textFn);

							if (terms.length === 0) {
								terms = [ term ];
							}
							if (rewards.length === 0) {
								rewards = [];
							}
							if (products.length === 0) {
								products = [];
							}

							return {
								Terms : terms,
								Rewards : rewards,
								Products : products
							};
						},

						setGeneralModel : function(model) {
							this.getView().setModel(model, "GeneralModel");
							this.generalModel = model;
							this.productController.setMasterdataSystemModel(this.generalModel);
							this.productGroupController.setMasterdataSystemModel(this.generalModel);
							this.productHierarchyController.setMasterdataSystemModel(this.generalModel);
							this.genericProductController.setMasterdataSystemModel(this.generalModel);
							this.displayProductController.setMasterdataSystemModel(this.generalModel);
							
						},

						getEventBus : function() {
							return sap.ui.getCore().getEventBus();
						},

						getText : function(key) {
							return this.resourceBundle.getProperty(key);
						},

						deleteConditions : function(oEvent) {
							var basePath = oEvent.getSource()
									.getBindingContext().getPath().split(
											"/Conditions")[0];
							var endPath = oEvent.getSource()
									.getBindingContext().getPath().split("/");
							var index = endPath[endPath.length - 1];

							basePath += "/Conditions";

							var conditions = this.data.getProperty(basePath);

							conditions = conditions.filter(function(condition,
									i) {
								return i !== parseInt(index, 10);
							});

							this.data.setProperty(basePath, conditions);

							refreshModel(this.data);
						},

						deleteIncentives : function(oEvent) {
							var basePath = oEvent.getSource()
									.getBindingContext().getPath().split(
											"/Incentives")[0];
							var endPath = oEvent.getSource()
									.getBindingContext().getPath().split("/");
							var index = endPath[endPath.length - 1];

							basePath += "/Incentives";

							var incentives = this.data.getProperty(basePath);

							incentives = incentives.filter(function(incentive,
									i) {
								return i !== parseInt(index, 10);
							});

							this.data.setProperty(basePath, incentives);

							refreshModel(this.data);
						},

						/*
						 * Opens the Menu containing the TermTypes
						 */
						handlePressOpenMenuTerm : function(oEvent) {
							var oButton = oEvent.getSource();
							var bindingContext = oEvent.getSource()
									.getBindingContext();

							if (!this._menu) {
								this._menu = sap.ui
										.xmlfragment(
												"retail.pmr.promotionaloffers.plugins.TermOptionsMenu",
												this);
								this.getView().addDependent(this._menu);
							}

							var eDock = sap.ui.core.Popup.Dock;
							this._menu.setBindingContext(bindingContext);
							this._menu.open(this._bKeyboard, oButton,
									eDock.BeginTop, eDock.BeginBottom, oButton);
						},

						/*
						 * Opens the Menu containing the RewardTypes
						 */
						handlePressOpenMenuReward : function(oEvent) {
							var oButton = oEvent.getSource();
							var bindingContext = oEvent.getSource()
									.getBindingContext();

							if (!this._rewardMenu) {
								this._rewardMenu = sap.ui
										.xmlfragment(
												"retail.pmr.promotionaloffers.plugins.RewardOptionsMenu",
												this);
								this.getView().addDependent(this._rewardMenu);
							}

							var eDock = sap.ui.core.Popup.Dock;
							this._rewardMenu.setBindingContext(bindingContext);
							this._rewardMenu.open(this._bKeyboard, oButton,
									eDock.BeginTop, eDock.BeginBottom, oButton);
						},

						/*
						 * Updates the label for each term. All terms except the
						 * first one must have label And/Or Term x. When the
						 * combo says All the label should be And
						 */
						updateTermsLabel : function() {
							/* Receives parameter 1 or 2 and returns And / Or */
							function getOperator(key) {
								var possibleValues = Utils.get(this.content
										.getData(), [ "Operators",
										"PossibleValues" ])
										|| [];
								return possibleValues
										.filter(
												function(possibleOperator) {
													return possibleOperator.Key === key;
												}).map(function(item) {
											return item.TermLevelText;
										})[0];
							}

							var terms = getTerms(this.data);

							/*
							 * Same thing as key =
							 * this.content.getData().Operators.Value; Done this
							 * way so that the tests won't fail
							 */
							var key = Utils.get(this.content.getData(), [
									"Operators", "Value" ]);
							var operator = getOperator.call(this, key);

							setupOperatorLabel(terms, operator);

							refreshModel(this.data);
						},

						getPossibleConditions : function() {
							return this.content
									.getProperty("/PossibleConditions");
						},

						setFinancials : function(financials) {
							this.data.setProperty("/Financials", financials);
							refreshModel(this.data);
						},

						setFinancialData : function(data) {
							var financials = jQuery.extend(true, [], this.data.getData().Financials);
							financials.forEach(function(financial, i) {
								financial.Data = data[i] ? data[i].Financials
										: null;
							});
							this.data.setProperty("/Financials", financials);
							
						},

						setupFinancials : function() {
							var i18n = Utils.getResourceModel();
							var rewards = getRewards(this.data) || [];
							var terms = getTerms(this.data) || [];
							var financials = [];
							var forTermIndexes = [];

							rewards.forEach(function(reward) {
								if (reward.ForTerm) {
									var termIndex = reward.ForTerm.Identifier;
									forTermIndexes
											.push(parseInt(termIndex, 10));
								}
							});

							terms
									.forEach(function(term, index) {
										if (forTermIndexes.indexOf(index + 1) === -1) {
											var newFinancial = {};
											newFinancial.TermType = term.TermType;
											newFinancial.Identifier = index + 1;
											newFinancial.TermOrReward = i18n
													.getProperty("CreateOffer.Terms.FreestyleOffer.FinancialsTextTerm");
											financials.push(newFinancial);
										}
									});

							rewards
									.forEach(function(reward, index) {
										if (reward.Type === "01"
												|| reward.Type === "02"
												|| reward.ForTerm) {
											var newFinancial = {};
											newFinancial.TermType = (reward.ForTerm || reward).TermType;
											newFinancial.Identifier = index + 1;
											newFinancial.TermOrReward = i18n
													.getProperty("CreateOffer.Terms.FreestyleOffer.FinancialsTextReward");
											financials.push(newFinancial);
										}
									});

							this.data.setProperty("/Financials", financials);
						},

						productDimensionChanged : function(oEvent) {
							var textFn = this.getText.bind(this);

							var term = objectFromEvent(oEvent);
							
							term.Selection.ProductId = null;
							term.Selection.HierarchyNodeId = null;
							term.Selection.HierarchyId = null;
							
							this.productDetails.remove(term);
							var dimType = term.Selection.DimensionType;
							term.DimensionTypeText = mapDimTypeToDimText(dimType,this.content.getProperty("/ProductDimensionsSet"));
							this.triggerDimensionValidation(oEvent);
							this.productController.resetInput(oEvent);
							this.productGroupController.resetInput(oEvent);
							this.productHierarchyController.resetInput(oEvent);
							this.genericProductController.resetInput(oEvent);
							this.displayProductController.resetInput(oEvent);
						},

						selectTermOption : function(oEvent) {

							var selection = $.extend({}, oEvent.getParameter(
									"item").getBindingContext("Content")
									.getObject());
							var termObject = oEvent.getSource()
									.getBindingContext().getObject();

							function isConditionType(selectionOption) {
								return selectionOption.hasOwnProperty("Class");
							}

							var addCondition = function() {
								var cls = selection.Class;
								var possibleConditions = this
										.getPossibleConditions();
								selection.Selection = {};
								selection.SubConditions = possibleConditions
										.filter(function(condition) {
											return condition.Class === cls;
										});
								selection.More = {
									Visible : false
								};
								termObject.Conditions.push(selection);
							}.bind(this);

							if (isConditionType(selection)) {
								addCondition(termObject, selection);
							} else {
								setSelectionOnTerm(termObject, {
									DimensionType : selection.DimensionType,
									TermType : selection.TermType,
									Type : selection.Type
								});
							}

							refreshModel(this.data);
						},

						selectRewardOption : function(oEvent) {

							var rewardObject = oEvent.getSource().getBindingContext().getObject();

							var selection = $.extend({}, oEvent.getParameter("item").getBindingContext().getObject());

							var rewards = getRewards(this.data) || [];

							function isIncentiveType(selection) {
								return selection.hasOwnProperty("Class");
							}

							function addIncentive(rewardObject, selection,
									possibleIncentives, cls) {
								selection.Selection = {};
								selection.SubIncentives = possibleIncentives
										.filter(function(incentive) {
											return incentive.Class === cls;
										});
								selection.More = {
									Visible : false
								};
								rewardObject.Incentives.push(selection);
							}

							var textFn = this.getText.bind(this);

							if (isIncentiveType(selection)) {
								var cls = selection.Class;
								var possibleIncentives = this.content
										.getProperty("/PossibleIncentives")
										|| [];
								addIncentive(rewardObject, selection,
										possibleIncentives, cls);
							} else {
								setSelectionOnReward(rewardObject, {
									DimensionType : selection.DimensionType,
									TermType : selection.TermType,
									Type : selection.Type
								});

								rewardObject.DimensionTypeText = mapDimTypeToDimText(
										rewardObject.Selection.DimensionType,
										this.content
												.getProperty("/ProductDimensionsSet"));
								this.setupFinancials();
							}

							if (rewardObject.Type === "02") {
								rewardObject.isWholeOffer = !rewardObject.ForTerm;
								var terms = getTerms(this.data);
								calculateRewardApplicabilities(rewards, terms, this.resourceBundle);
							}

							clearErrors(rewards);
							markErrors(rewards, null, null);

							refreshModel(this.data);
						},

						/*
						 * Each Condition has x SubConditions; When one is
						 * selected we need to get the ProdRelevant/QtyRelevant
						 * properties in the upper layer. So we have a Condition
						 * with x SubConditions. When one SubCondition is
						 * selected, we need the info about the selected id,
						 * prodRelevant and qtyRelevant so we bind it to
						 * SelectedSubConditionXXXXXXX
						 */
						selectSubCondition : function(oEvent) {
							var subConditionProps = objectFromElement(oEvent.getParameter("selectedItem")).SubConditionsProps;
							
							var selectedSubConditionProdRelevant = subConditionProps.isProductRelevant;
							var selectedSubConditionQuantityRelevant = subConditionProps.isQuantityRelevant;
							if (subConditionProps.isProductRelevant === "O") {
							    switch(subConditionProps.CategoryCode) {
							        case "01": // Object-Coupon
							            selectedSubConditionProdRelevant = "O01";
							            break;
							        case "09": // Object-Offer
							            selectedSubConditionProdRelevant = "O09";
							            break;
							    }  
							    
							}

							var path = oEvent.getSource().getBindingContext().getPath();
							
							var prodRelevantPath = path + "/ProductRelevant";
							var quantityRelevantPath = path + "/QuantityRelevant";
							var prodValuePath = path + "/Selection/ProductId";
							var prodCodePath = path + "/Selection/ExtProductId";
							var quantityValuePath = path + "/Selection/Quantity";
							if(selectedSubConditionProdRelevant === "O01" || selectedSubConditionProdRelevant === "O09") {
							    var offerValuePath = path + "/Selection/OfferId";
                                this.data.setProperty(offerValuePath, null);
							}
							this.data.setProperty(prodValuePath, null);
							this.data.setProperty(prodCodePath, null);
							this.data.setProperty(quantityValuePath, "0");
							
							this.data.setProperty(prodRelevantPath, selectedSubConditionProdRelevant);
							this.data.setProperty(quantityRelevantPath, selectedSubConditionQuantityRelevant);

							refreshModel(this.data);
						},

						/* Same as for Conditions */
						selectSubIncentive : function(oEvent) {
							var subIncentivesProps = objectFromElement(oEvent.getParameter("selectedItem")).SubIncentivesProps;
							
							var selectedSubIncentiveProdRelevant = subIncentivesProps.isProductRelevant;
							var selectedSubIncentiveQuantityRelevant = subIncentivesProps.isQuantityRelevant;
							if (subIncentivesProps.isProductRelevant === "O") {
							    switch(subIncentivesProps.CategoryCode) {
							        case "01": // Object-Coupon
							            selectedSubIncentiveProdRelevant = "O01";
							            break;
							        case "09": // Object-Offer
							            selectedSubIncentiveProdRelevant = "O09";
							            break;
							    }  
							}
							
							var path = oEvent.getSource().getBindingContext().getPath();
							
							var prodRelevantPath = path + "/ProductRelevant";
							var quantityRelevantPath = path + "/QuantityRelevant";
							var prodValuePath = path + "/Selection/ProductId";
							var prodCodePath = path + "/Selection/ExtProductId";
							var quantityValuePath = path + "/Selection/Quantity";
							if(selectedSubIncentiveProdRelevant === "O01" || selectedSubIncentiveProdRelevant === "O09" ) {
							    var offerValuePath = path + "/Selection/OfferId";
                                this.data.setProperty(offerValuePath, null);
							}
							this.data.setProperty(prodValuePath, null);
							this.data.setProperty(prodCodePath, null);
							this.data.setProperty(quantityValuePath, 0);

							this.data.setProperty(prodRelevantPath, selectedSubIncentiveProdRelevant);
							this.data.setProperty(quantityRelevantPath, selectedSubIncentiveQuantityRelevant);

							this.triggerDimensionValidation(oEvent);
						},

						termLevelAddButtonPressed : function(oEvent) {
							var terms = getTerms(this.data);
							var rewards = getRewards(this.data);
							var textFn = this.getText.bind(this);
							
							var newTerm = addTerm(terms, textFn, this._oLastTermTemplate);

							this.updateTermsLabel();
							this.setupFinancials();

							if (this.generalModel.getProperty("/PackageOffer")) {
								var newReward = this.rewardLevelAddButtonPressed(oEvent);
								setupLinksBetweenTermAndReward(newReward, {
									Term : newTerm
								});
								newReward.isWholeOffer = false;
								newReward.Type = "03";
								var rewardOptions = this.content.getData().RewardOptions;
								var packageOffer = this.generalModel.getProperty("/PackageOffer");								
								computeRewardOptions(newReward, "ForTerm", rewardOptions, packageOffer);
								calculateRewardApplicabilities(rewards, terms, this.resourceBundle);
								

							} else {
								calculateRewardApplicabilities(rewards, terms, this.resourceBundle);
								

							}

							refreshModel(this.data);
							this.updatePackageAppropiation();
							this.updatePackageUserProjection();
						},

						termLevelRemoveButtonPressed : function(e) {
							var termObject = objectFromEvent(e);
							var terms = getTerms(this.data);
							var rewards = getRewards(this.data);
							
							var linkedReward = rewards.filter(function(reward) {
								return reward.ForTerm === termObject;
							})[0];

							this.productDetails.remove(termObject);
							clearErrors(rewards, terms);

							if (this.generalModel.getProperty("/PackageOffer")) {
								var forTerm = rewards.filter(function(reward) {
									return !reward.isWholeOffer;
								});
								if (forTerm.length === 1) {
									setupLinksBetweenTermAndReward(linkedReward, {
										Term : termObject
									});
									linkedReward.isWholeOffer = false;
									linkedReward.Type = "03";
								} else {
									removeReward(rewards, linkedReward);
								}

								setupIndentifiers(rewards);

							} else {

								markErrors(rewards, termObject, null);

								/*
								 * Clear ForTerm from rewards that are for term
								 * termObject
								 */
								rewards.forEach(function(reward) {
									if (reward.ForTerm && reward.ForTerm.Identifier === termObject.Identifier) {
										reward.ForTerm = null;
									}
								});
							}
							removeTerm(terms, termObject);
							
							var changesToTerms = setupIndentifiers(terms);
							this.productDetails.updateIdentifiers(changesToTerms);

														
							this.updateTermsLabel();
							this.setupFinancials();
							
							calculateRewardApplicabilities(rewards, terms, this.resourceBundle);

							if(terms.length === 1 && terms[0] === termObject){
								setupLinksBetweenTermAndReward(linkedReward, { Term : terms[0] });
							}else{
								clearReward(linkedReward);
							}
							refreshModel(this.data);
							this.updatePackageAppropiation();
							
						},
						removeTermSelection : function(oEvent) {
							var termObject = objectFromEvent(oEvent);
							var sPath = oEvent.getSource().getBindingContext().sPath;

							Utils.removeMessagesByPatialPath(sPath);

							this.productDetails.remove(termObject);
							clearTerm(termObject);
							refreshModel(this.data);
						},

						updateUserProjection : function(e){
							var term = objectFromEvent(e);
							var dimensionType = Utils.get(term, ["Selection", "DimensionType"]);
							if(dimensionType !== "01"){
								return;
							}
							this.updateProductDetails(e, "UserProjection");
						},
						
						onLoadingProductGroupPage : function(e) {
							var isLoading = e.getParameter("isLoading");
							if (isLoading) {
								this.loadDataBusyDialog = new sap.m.BusyDialog();
								this.getView().addDependent(this.loadDataBusyDialog);
								this.loadDataBusyDialog.open();
							} else {
								this.loadDataBusyDialog.close();
							}
						},
						
						

						removeRewardSelection : function(oEvent) {
							var rewardObject = objectFromEvent(oEvent);
							var rewards = getRewards(this.data);

							if (rewardObject.ForTerm) {
								this.productDetails.update(rewardObject.ForTerm, "DiscountType",null);
								this.productDetails.update(rewardObject.ForTerm, "DiscountValue",null);
								this.productDetails.update(rewardObject.ForTerm,"SubDiscountValue", null);
								this.productDetails.update(rewardObject.ForTerm,"DiscountTypeLabel", null);
							} else {
								this.productDetails.remove(rewardObject);
							}

							clearReward(rewardObject);
							rewardObject.isWholeOffer = false;
							this.setupFinancials();
							clearErrors(rewards);
							markErrors(rewards, null, null);
							refreshModel(this.data);
						},

						rewardLevelAddButtonPressed : function(e) {
							var rewards = getRewards(this.data);
							var terms = getTerms(this.data);
							var textFn = this.getText.bind(this);
							var packageOffer = this.generalModel.getProperty("/PackageOffer");	
							
							var newReward = addReward(rewards, textFn, this._oRewardTemplate);
							calculateRewardApplicabilities(rewards, terms, this.resourceBundle);

							if (packageOffer) {
								newReward.Type = null;
								newReward.Applicability = "" + newReward.Applicabilities.filter(function(a) {
									return a instanceof Types.RewardApplicabilityWholeOffer;
								}).map(function(a) {
									return a.Id;
								})[0];
								
								newReward.isWholeOffer = true;
								var rewardOptions = this.content.getData().RewardOptions;								
								computeRewardOptions(newReward, "WholeOffer", rewardOptions, packageOffer);
							}

							this.triggerDimensionValidation(e);
							refreshModel(this.data);

							return newReward;
						},

						rewardLevelRemoveButtonPressed : function(e) { 
							var rewardObject = objectFromEvent(e);
							var rewards = getRewards(this.data);
							var terms = getTerms(this.data);
							var packageOffer = this.generalModel.getProperty("/PackageOffer");
							
							if (!rewardObject.isWholeOffer && rewardObject.ForTerm) {
								rewardObject.PackageValue = null;
								rewardObject.PercentageValue = null;
								this.productDetails.update(rewardObject.ForTerm, "DiscountType", null);
								this.productDetails.update(rewardObject.ForTerm, "DiscountValue", null);
								this.productDetails.update(rewardObject.ForTerm, "SubDiscountValue", null);
								this.productDetails.update(rewardObject.ForTerm, "DiscountTypeLabel", null);
							} else {
								this.productDetails.remove(rewardObject);
							}

							if (!packageOffer || rewardObject.isWholeOffer) {
								removeReward(rewards, rewardObject);
								var changesToRewards = setupIndentifiers(rewards);
								this.productDetails.updateIdentifiers(changesToRewards);
								calculateRewardApplicabilities(rewards, terms, this.resourceBundle);
							} else {
								clearReward(rewardObject, true);
								rewardObject.Type = "03"; // approriation
							}
							clearErrors(rewards, terms);
							markErrors(rewards, null, rewardObject);
							this.setupFinancials();
							refreshModel(this.data);
							this.updatePackageAppropiation();
						},

						linkRewardOptionsInsteadOf : function(selection, reward) {
							if (selection.Type === "WholeOffer" && reward.InsteadOfLinkedReward) {
								reward.InsteadOfLinkedReward.RewardOptions = jQuery.extend(true, [], reward.RewardOptions);
							}
						},

						rewardForSelected : function(e) {
							var reward = objectFromEvent(e);
							var selection = objectFromElement(e.getParameter("selectedItem"));
							var terms = getTerms(this.data);
							var rewards = getRewards(this.data);
							var textFn = this.getText.bind(this);
							var linkedTerm = reward.ForTerm;
							
							this.setupLinkForReward(reward, selection);
							this.setupFinancials();
							
							if (!e.getParameter("selectedItem")) {
								reward.Error = "Error";
								return;
							}
							
							if (linkedTerm && reward.Error !== "Error") {
								this.productDetails.update(linkedTerm, "DiscountType",null);
								this.productDetails.update(linkedTerm, "DiscountValue",null);
								this.productDetails.update(linkedTerm,"SubDiscountValue", null);
								this.productDetails.update(linkedTerm,"DiscountTypeLabel", null);
								this.productDetails.update(linkedTerm,"DiscountDescription", null);
							}
							
							if (rewards.indexOf(reward) > 0) {
								if (selection.Type === "InsteadOf") {
									reward.Operation = "2";
								} else {
									reward.Operation = "1";
								}
							}
							calculateRewardApplicabilities(rewards, terms, this.resourceBundle);
							
							this.productDetails.update(reward, "DiscountType", null);
							this.productDetails.update(reward, "DiscountValue", null);
							this.productDetails.update(reward, "SubDiscountValue", null);
							this.productDetails.update(reward,"DiscountTypeLabel", null);
							this.productDetails.update(reward,"DiscountDescription", null);

							if (selection.Type === "ForTerm" || selection.Type === "WholeOffer" || selection.Type === "InsteadOf") {
								reward.Type = "";
								clearReward(reward, true);
								reward.TermType = "2";
								this.productDetails.remove(reward);
							}

							if (selection.Type === "WholeOffer" || selection.Type === "InsteadOf") {
								reward.Selection.DimensionType = "01";
								reward.DimensionTypeText = textFn("CreateOffer.Terms.FreestyleOffer.Product");
							}

							if (selection.Type !== "WholeOffer" && selection.Type !== "InsteadOf") {
								reward.isWholeOffer = false;
							}

							
							refreshModel(this.data);
						},
						setupLinkForReward : function(reward, selection) {
							var rewards = getRewards(this.data);

							clearErrors(rewards);
							setupLinksBetweenTermAndReward(reward, selection);
							setupLinksBetweenRewards(reward, selection);
							if (selection) {
								var rewardOptions = this.content.getData().RewardOptions;
								var packageOffer = this.generalModel.getProperty("/PackageOffer");	
								
								computeRewardOptions(reward, selection.Type, rewardOptions, packageOffer);
								this.linkRewardOptionsInsteadOf(selection, reward);
							}

							markErrors(rewards, null, null);
						},

						validate : function() {
							var terms = getTerms(this.data);
							var rewards = getRewards(this.data);
							var allTerms = terms.concat(rewards);

							clearErrors(rewards, terms);
							markErrors(rewards, null, null, terms);

							var oMessageManager = Utils.getMessageManager();
							var aMessages = oMessageManager.getMessageModel().getData();
							var errorCountFromMessageManager = aMessages.filter(function(message) {
								return message.target.indexOf("/Terms") > -1
										|| message.target.indexOf("/Rewards") > -1
										|| message.target.indexOf("/ProductDetails") > -1;
							}).length;

                            // if has error don't refresh model otherwise the error is lost
                            if (errorCountFromMessageManager === 0) {
							   refreshModel(this.data);
                            }

							return allTerms.filter(function(term) {
								return term.Error === "Error";
							}).length + errorCountFromMessageManager;
						},

						setTermsData : (function() {
							
							function hasValue(value, properties) {
								return properties.map(function(prop) {
									return parseInt(value[prop], 10);
								}).reduce(function(result, value) {
									return result || value;
								}, false);
							}
							
							function createIncentive(item) {
								var possibleIncentives = this.content.getProperty("/PossibleIncentives");
								var possibleConditions = this.content.getProperty("/PossibleConditions");
								var allIncentives = possibleIncentives.concat(possibleConditions);
								var newIncentive = {};
								var sProductRelevant = "";

								for (var i = 0; i < allIncentives.length; i++) {
									if (allIncentives[i].Id === item.Type) {
									    var oSubProps = allIncentives[i].SubIncentivesProps;
									    if (oSubProps && oSubProps.isProductRelevant === "O") {
									        sProductRelevant = oSubProps.isProductRelevant + oSubProps.CategoryCode;
									    }
										newIncentive = {
											IncentiveId: item.Id,
											Class : allIncentives[i].Class,
											Description : allIncentives[i].ClassDescription,
											Id : item.Type,
											Type : allIncentives[i].Type,
											TermId : item.TermId
										};
										break;
									}
								}
								newIncentive.Selection = {};
								if (newIncentive.Type === "0") {
									newIncentive.QuantityRelevant = item.Quantity ? "X" : "";
									newIncentive.Selection.Quantity = item.Quantity ? item.Quantity + "" : null;
									newIncentive.Selection.ProductId = item.ProductId ? item.ProductId : null;
									newIncentive.Selection.ExtProductId = !item.ProductId && item.ExtProductId ? item.ExtProductId : null;
									newIncentive.ProductRelevant = item.ProductId ? "X" : item.ExtProductId ? "F" : "";
							        if (sProductRelevant === "O01" || sProductRelevant === "O09") {
							            newIncentive.ProductRelevant = sProductRelevant;
							            newIncentive.Selection.OfferId = item.ProductId ? item.ProductId : null;
							        }
									newIncentive.Selection.Type = item.Type;
									newIncentive.Selection.Cost = item.Cost ? parseFloat(item.Cost, 10).toFixed(2) + "" : null;
									newIncentive.Selection.AdjustedCost = item.AdjustedCost ? parseFloat(item.AdjustedCost, 10).toFixed(2) + "" : null;
									newIncentive.Selection.Value = item.Value ? parseFloat(item.Value, 10).toFixed(2) + "" : null;
									newIncentive.Selection.AdjustedValue = item.AdjustedValue ? parseFloat(item.AdjustedValue, 10).toFixed(2) + "" : null;
									newIncentive.Selection.RedemptionRate = item.RedemptionRate ? parseFloat(item.RedemptionRate, 10).toFixed(2) + "" : null;

									if (hasValue(newIncentive.Selection, FreestyleViewFormatters.INCENTIVE_MORE_PROPERTIES)) {
										newIncentive.More = {
											Visible : true
										};
									} else {
										newIncentive.More = {
											Visible : false
										};
									}

									newIncentive.SubConditions = allIncentives.filter(function(incentive) {
										return incentive.Class === item.Class;
									});
								}
								if (newIncentive.Type === "1") {
									newIncentive.QuantityRelevant = item.Quantity ? "X" : "";
									newIncentive.Selection.Quantity = item.Quantity ? item.Quantity + "" : null;
									newIncentive.Selection.ProductId = item.ProductId ? item.ProductId : null;
									newIncentive.Selection.ExtProductId = !item.ProductId && item.ExtProductId ? item.ExtProductId : null;
									newIncentive.ProductRelevant = item.ProductId ? "X" : item.ExtProductId ? "F" : "";
									if (sProductRelevant === "O01" || sProductRelevant === "O09") {
							            newIncentive.ProductRelevant = sProductRelevant;
							            newIncentive.Selection.OfferId = item.ProductId ? item.ProductId : null;
							        }
									newIncentive.Selection.Type = item.Type;
									newIncentive.Selection.Cost = item.Cost ? parseFloat(item.Cost, 10).toFixed(2) + "" : null;
									newIncentive.Selection.AdjustedCost = item.AdjustedCost ? parseFloat(item.AdjustedCost, 10).toFixed(2) + "" : null;
									newIncentive.Selection.Value = item.Value ? parseFloat(item.Value, 10).toFixed(2) + "" : null;
									newIncentive.Selection.AdjustedValue = item.AdjustedValue ? parseFloat(item.AdjustedValue, 10).toFixed(2) + "" : null;
									newIncentive.Selection.RedemptionRate = item.RedemptionRate ? parseFloat(item.RedemptionRate, 10).toFixed(2) + "" : null;

									if (hasValue(newIncentive.Selection, FreestyleViewFormatters.INCENTIVE_MORE_PROPERTIES)) {
										newIncentive.More = {
											Visible : true
										};
									} else {
										newIncentive.More = {
											Visible : false
										};
									}

									newIncentive.SubIncentives = allIncentives.filter(function(incentive) {
										return incentive.Class === item.Class;
									});
								}

								return newIncentive;
							}

							function getDefaultTerm(item, index) {
								var result = new Types.Term(index + 1, [], item.DimensionType); // Type comes
								// from
								// DimensionType.
								// Not sure
								// about this..
								result.TermType = item.TermType;
								result.Type = item.DimensionType; // Not so
								// sure
								// about
								// this
								result.OfferId = item.OfferId || "";
								if (!item.TermId) {
									item.TermId = "Term " + index;
								}
								result.TermId = item.TermId;
								result.Selection = {};

								for ( var key in item) {
									if (item.hasOwnProperty(key) && !jQuery.isArray(item[key])) {
										if (item[key]) {
											result.Selection[key] = item[key];
										}
									}
								}
								
								delete result.Selection.DiscountType;
								delete result.Selection.DiscountTypeName;
								delete result.Selection.DiscountValue;
								delete result.Selection.SubDiscountValue;
								
								result.Selection.DimensionType = item.DimensionType || null;
								result.Selection.UnitOfMeasure = item.UnitOfMeasure || null;
								result.Selection.ExtHierarchyId = item.ExtHierarchyId || null;
								result.Selection.ExtHierarchyNodeId = item.ExtHierarchyNodeId || null;
								result.Selection.Quantity = item.Quantity || "0";
								result.Selection.MinAmount = item.MinAmount || "0";
								result.Selection.UserProjection = item.UserProjection || null;
								result.Selection.PromoCostPrice = item.PromoCostPrice || "0";
								result.Selection.PromoCostPriceCurrency = item.PromoCostPriceCurrency || item.Currency || null;
								result.DiscountTypeLabel = item.DiscountTypeName;
								result.DiscountType = item.DiscountType;
								result.DiscountValue = item.DiscountValue;
								
								result.UnitOfMeasures = (item.UoMs || []).map(function(uom){
									return {
										Id : uom.Unit,
										Name : uom.Unit
									};
								});
								
								result.ProductTextValue = item.ExtProductId || item.ExtHierarchyNodeId || item.ExtHierarchyId;
								result.ProductDescriptionValue = item.Description;
								if(item.DiscountType === "04"){
									result.DiscountDescription = "%";
								}else {
									result.DiscountDescription = item.Currency;
								}
								result.DimensionTypeText = mapDimTypeToDimText(item.DimensionType, this.content.getProperty("/ProductDimensionsSet"));
								if (!Utils.isInitial(item.ProductId)) {
									result.Selection.ProductId = item.ProductId;
								} else {
									delete result.Selection.ProductId;
								}
								if (!Utils.isInitial(item.HierarchyId)) {
									result.Selection.HierarchyId = item.HierarchyId;
								} else {
									delete result.Selection.HierarchyId;
								}

								if (!Utils.isInitial(item.HierarchyNodeId)) {
									result.Selection.HierarchyNodeId = item.HierarchyNodeId;
								} else {
									delete result.Selection.HierarchyNodeId;
								}

								if (item.TermProducts) {
									result.TermProducts = jQuery.extend(true, [], item.TermProducts.concat());
								}
								if (hasValue(result.Selection, FreestyleViewFormatters.TERM_MORE_PROPERTIES)) {
									result.More = {
										Visible : true
									};
								} else {
									result.More = {
										Visible : false
									};
								}
								
								return result;
							}

							function createReward(self, item, index) {
								var result = new Types.Reward(index + 1);
								var isWholeOffer = item.ProductId || item.HierarchyNodeId || item.HierarchyId || item.DimensionType === "20";
								if (isWholeOffer) {
									result.Type = "02";
								}
								result.TermType = "2";

								result.isWholeOffer = !!isWholeOffer;
								result.Selection = {};

								for ( var key in item) {
									if (item.hasOwnProperty(key) && !jQuery.isArray(item[key])) {
										if (item[key]) {
											result.Selection[key] = item[key];
										}
									}
								}
								result.Selection.DimensionType = item.DimensionType || null;
								result.Selection.DiscountType = item.DiscountType || null;
								result.Selection.DiscountValue = item.DiscountValue || null;								
								result.Selection.DiscountAssignment = item.DiscountAssignment;
								result.Selection.Variety = item.Variety;
								result.Selection.UnitOfMeasure = item.UnitOfMeasure || null;
								result.SubDiscountValue = null;
								result.Selection.SubDiscountValue =  parseFloat(item.SubDiscountValue) > 0 ? item.SubDiscountValue : null;
								result.Selection.Quantity = item.Quantity || null;
								result.Selection.UserProjection = item.UserProjection || null;
								result.Selection.PromoCostPrice = item.PromoCostPrice || null;
								result.Selection.PromoCostPriceCurrency = item.PromoCostPriceCurrency || item.Currency || null;
								result.Selection.Description = item.Description || null;
								result.Selection.ExtProductId = item.ExtProductId || null;
								result.Selection.ExtHierarchyId = item.ExtHierarchyId || null;
								result.Selection.ExtHierarchyNodeId = item.ExtHierarchyNodeId || null;
								result.DimensionTypeText = mapDimTypeToDimText(item.DimensionType, self.content.getProperty("/ProductDimensionsSet"));

								result.ProductTextValue = item.ExtProductId ||  item.ExtHierarchyNodeId || item.ExtHierarchyId;
								result.ProductDescriptionValue = item.Description;
								if(item.DiscountType === "04"){
									result.DiscountDescription = "%";
								}else {
									result.DiscountDescription = item.Currency;
								}
								result.UnitOfMeasures = (item.UoMs || []).map(function(uom){
									return {
										Id : uom.Unit,
										Name : uom.Unit
									};
								});
								
								result.DiscountTypeLabel = item.DiscountTypeName;
								result.DiscountType = item.DiscountType;

								if (!Utils.isInitial(item.ProductId)) {
									result.Selection.ProductId = item.ProductId;
								} else {
									delete result.Selection.ProductId;
								}
								if (!Utils.isInitial(item.HierarchyId)) {
									result.Selection.HierarchyId = item.HierarchyId;
								} else {
									delete result.Selection.HierarchyId;
								}
								if (!Utils.isInitial(item.HierarchyNodeId)) {
									result.Selection.HierarchyNodeId = item.HierarchyNodeId;
								} else {
									delete result.Selection.HierarchyNodeId;
								}

								if (item.Operation) {
									result.Operation = item.Operation;
								}

								if (item.TermProducts) {
									result.TermProducts = jQuery.extend(true, [], item.TermProducts.concat());
								}

								if (hasValue(result.Selection, FreestyleViewFormatters.TERM_MORE_PROPERTIES)) {
									result.More = {
										Visible : true
									};
								} else {
									result.More = {
										Visible : false
									};
								}
								return result;
							}

							function createADiscountReward(self, item, index, terms, applicabilities) {
								var reward = createReward(self, item, index);
								var rewardOptions = self.content.getData().RewardOptions;
								var packageOffer = self.generalModel.getProperty("/PackageOffer");		
								
								reward.Type = "01";
								reward.ForTerm = terms[index];
								reward.TermId = terms[index].TermId;
								reward.isWholeOffer = false;
								computeRewardOptions(reward, "ForTerm", rewardOptions, packageOffer);

								applicabilities.push(index + "");

								return reward;
							}

							function isADiscount(item) {
								return item.DiscountType && !!item.DiscountType.length;
							}

							function determineApplicability(self, reward, index, rewards) {
								var rewardOptions = self.content.getData().RewardOptions;
								var packageOffer = self.generalModel.getProperty("/PackageOffer");
								if (reward.Operation === "2") {									
									for (var i = 0; i < reward.Applicabilities.length; i++) {
										if (reward.Applicabilities[i].Type === "InsteadOf") {
											computeRewardOptions(reward, "WholeOffer", rewardOptions, packageOffer);
											reward.LinkedReward = reward.Applicabilities[i].Reward;
											reward.LinkedReward.InsteadOfLinkedReward = reward;
											return i + "";
										}
									}
								} else {
									for (var i = 0; i < reward.Applicabilities.length; i++) {
										if (reward.Applicabilities[i].Type === "WholeOffer") {
											computeRewardOptions(reward, "WholeOffer", rewardOptions, packageOffer);
											reward.LinkedReward = null;
											return i + "";
										}
									}
								}

								return null;
							}

							function setupApplicabilities(self, applicabilities, rewards, terms, aDiscountRewards, resourceBundle) {
								calculateRewardApplicabilities(rewards, terms, resourceBundle);

								aDiscountRewards.forEach(function(item) {
									item.Applicability = applicabilities.shift();
								});

								rewards.forEach(function(reward, index) {
									if (reward.Applicability) {
										return;
									}
									reward.Applicability = determineApplicability(self, reward, index, rewards);
								});
							}
							
							function byTermId(termId) {
								return function(term) {
									return term.TermId === termId;
								};
							}
							
							function addRewardId(rewardIds, reward, i) {
								reward.RewardId = rewardIds[i] || "";

								return reward;
							}
							
							var getProductData = (function(terms) {
								function addAdditionalProductData(term, products, termName) {
									products.forEach(function(product) {
										if (product.Id === term.TermId) {
											product.Terms = termName;
											product.DiscountType = term.DiscountTypeName;
											product.DiscountValue = term.DiscountValue;
											product.RegularPrice = term.RegularPrice;
											product.PurchasePrice = term.PurchasePrice;
											product.UserProjection = term.UserProjection;
											product.SubDiscountValue = term.SubDiscountValue;
											product.LockUserProjection = term.LockUserProjection;
											product.PromoCostPrice = term.PromoCostPrice;
											product.PromoCostPriceCurrency = term.PromoCostPriceCurrency;
											product.Description = "";
										}
									});
								}
								
								return  function() {
									var toReturn = [];
									if (terms) {
										for (var i = 0; i < terms.length; i++) {
											if (terms[i].TermProducts) {
												toReturn.push.apply(toReturn, terms[i].TermProducts);
												var termNumber = i + 1;
												addAdditionalProductData(terms[i], toReturn, "Term " + termNumber);
											}
										}
									}
									return toReturn;
								};
							}());
							
							function findRewardForTerm(terms, rewards, termId) {
								var reward = rewards.filter(function(reward) {
									return reward.TermId === termId;
								})[0];

								if (!reward) {
									reward = new Types.Reward(rewards.length + 1, null, null, "ForTerm");
									reward.Type = null;
									reward.TermId = termId;
									reward.ForTerm = terms.filter(byTermId(termId))[0];
									reward.Applicability = terms.indexOf(reward.ForTerm) + "";
									rewards.push(reward);
								}

								return reward;
							}
							
							return function(data) {
								if (!data) {
									return;
								}
								
								var textFn = this.getText.bind(this);
								data.Terms = data.Terms || [];
								data.Incentives = data.Incentives || [];
								
								data.Terms.forEach( function(oTerm) { Calculator.extendFinancials(oTerm.Financials); });
								
								var leftSideData = data.Terms.filter(function(item) {
									return item.TermType === "1";
								});
								var rightSideData = data.Terms.filter(function(item) {
									return item.TermType === "2";
								});

								if (leftSideData.length > 1) {
									var operation = leftSideData[1].Operation;
									this.content.setProperty("/Operators/Value", operation);
								}

								var terms = leftSideData.map(getDefaultTerm.bind(this));
								var applicabilities = [];
								var aDiscountRewards = [];

								leftSideData.forEach(function(item, index) {
									if (isADiscount(item)) {
										aDiscountRewards.push(createADiscountReward(this, item, index, terms, applicabilities));
									}
								}.bind(this));

								var incentiveOnlyRewards = (data.Incentives || []).map(createIncentive.bind(this));

								var rewardIds = rightSideData.map(function(data) {
									return data.TermId;
								});

								var rewards = aDiscountRewards.concat(rightSideData.map(createReward.bind(null, this)).map(addRewardId.bind(null, rewardIds)));
								var products = getProductData(data.Terms);

								this.data.setData(this.getDefaultTerms(terms, rewards, products));

								var allIncentives = data.Terms.map(function(term) {
									return (term.Incentives || []).map(function(incentive) {
										incentive.TermId = term.TermId;
										return incentive;
									});
								}).reduce(function(a, b) {
									return a.concat(b);
								}, []).map(createIncentive.bind(this));

								terms = getTerms(this.data);
								rewards = getRewards(this.data);

								var leftSideIncentives = allIncentives.filter(function(incentive) {
									return incentive.Type === "0";
								});

								var rightSideIncentives = allIncentives.filter(function(incentive) {
									return incentive.Type === "1";
								});

								terms.forEach(function(term) {
									term.Conditions = leftSideIncentives.filter(function(incentive) {
										return incentive.TermId === term.TermId;
									});
								});

								rewards.forEach(function(reward) {
									reward.Incentives = rightSideIncentives.filter(function(incentive) {
										return incentive.TermId === reward.RewardId;
									});
								});

								rightSideIncentives.forEach(function(incentive) {
									if (terms.some(byTermId(incentive.TermId))) {
										var rewardForTerm = findRewardForTerm(terms, rewards, incentive.TermId);
										rewardForTerm.Incentives.push(incentive);
									}
								});

								if (incentiveOnlyRewards.length) {
									var incentiveReward = new Types.Reward(rewards.length + 1, null, null, "");
									incentiveReward.isWholeOffer = true;
									incentiveReward.Applicabilities = createApplicabilitiesForReward(terms, this.getText.bind(this));
									incentiveReward.Applicability = findCorrectAplicabilitity(incentiveReward);
									incentiveReward.Incentives = incentiveOnlyRewards;
									rewards.push(incentiveReward);
								}

								if (rewards.length === 0) {
									var defaultReward = createBlankReward("1",textFn);
									defaultReward.Applicabilities = createApplicabilitiesForReward(terms, this.getText.bind(this));
									defaultReward.Applicability = findCorrectAplicabilitity(defaultReward);
									if(defaultReward.Applicability) {
										defaultReward.ApplicabilityName = defaultReward.Applicabilities[defaultReward.Applicability].Name;
									}
									var packageOffer = this.generalModel.getProperty("/PackageOffer");
									if(!packageOffer){
										defaultReward.isWholeOffer = true;
										rewards.push(defaultReward);
									}
								}
								var rewardOptions = this.content.getData().RewardOptions;
								var packageOffer = this.generalModel.getProperty("/PackageOffer");
								rewards.forEach(function(item, index) {
									if(item.isWholeOffer) {
										computeRewardOptions(item, "WholeOffer", rewardOptions, packageOffer);
									}
								});
								if(packageOffer) {
									terms.forEach(function(term){
										var reward = findRewardForTerm(terms, rewards, term.Selection.TermId);
										reward.isWholeOffer = false;
										reward.Type = "03";
										reward.Applicabilities = createApplicabilitiesForReward(terms, this.getText.bind(this));
										reward.Applicability = findCorrectAplicabilitity(reward);
										computeRewardOptions(reward, "ForTerm", rewardOptions, packageOffer);
									}, this);
								}
								
								setupApplicabilities(this, applicabilities, rewards, terms, aDiscountRewards, this.resourceBundle);
								setupIndentifiers(terms);
								setupIndentifiers(rewards);

								refreshModel(this.data);
							};
						}()),

						setStaticData : function(data) {

							if (data && data.staticData) {
								this.content.setProperty("/DiscountTypes", data.staticData.DiscountTypeSet);
								this.content.setProperty("/ProductDimensionsSet", data.staticData.ProductDimensionsSet);
								this.content.setProperty("/ProductDimensionsSetExcludingTransaction", data.staticData.ProductDimensionsSet.filter(function(item) {
									return item.Key !== "20";
								}));

								this.content.setProperty("/DiscountAssignments", data.staticData.DiscountAssignmentSet);
								this.content.setProperty("/DiscountVarieties", data.staticData.DiscountVarietySet);
								
								this.content.setProperty("/CurrencyList", data.staticData.CurrencyListSet || []);

							}

							if (data) {this.content.setProperty("/Editable", data.editable);
							}

							if (data && data.staticData) {
								/*
								 * Condition is an IncentiveDefinition for left
								 * side (buy section) Incentive is an
								 * IncentiveDefinition for right side (get
								 * section)
								 */
								var conditionsType = data.staticData.IncentiveDefinitions.filter(function(incentive) {
									return incentive.Type === "0";
								});
								conditionsType = removeDuplicates(conditionsType);
								conditionsType = conditionsType.map(function(conditionType) {
									return new Types.ConditionType(
											conditionType.Id,
											conditionType.Class,
											conditionType.Type,
											conditionType.ClassDescription);
								});

								var rewardOptions = data.staticData.GetOptions.map(function(getOption, index) {
									return new Types.RewardType(index,
											getOption.Value, "01",
											getOption.Key);
								});

								var i18n = Utils.getI18NModel().getResourceBundle();
								
								var appropriationItemTitle = i18n.getText("CreateOffer.Terms.FreestyleOffer.Appropriation");
								
								rewardOptions.push(new Types.RewardType(rewardOptions.length + 1, appropriationItemTitle, "01", "03"));

								var incentivesType = data.staticData.IncentiveDefinitions.filter(function(incentive) {
									return incentive.Type === "1";
								});

								incentivesType = removeDuplicates(incentivesType);
								incentivesType = incentivesType.map(function(incentiveType) {
									return new Types.IncentiveType(
											incentiveType.Id,
											incentiveType.Class,
											incentiveType.Type,
											incentiveType.ClassDescription);
								});
								rewardOptions = rewardOptions.concat(incentivesType);

								var conditions = data.staticData.IncentiveDefinitions.filter(function(incentive) {
									return incentive.Type === "0";
								});
								conditions = conditions.map(function(condition) {
									return new Types.Condition(
											condition.Id,
											condition.Class,
											condition.ClassDescription,
											condition.Description,
											condition.Type,
											condition.ProductRelevant,
											condition.QuantityRelevant,
											condition.CategoryCode
                                    );
								});

								var incentives = data.staticData.IncentiveDefinitions.filter(function(incentive) {
									return incentive.Type === "1";
								});
								incentives = incentives.map(function(incentive) {
									return new Types.Incentive(
											incentive.Id,
											incentive.Class,
											incentive.ClassDescription,
											incentive.Description,
											incentive.Type,
											incentive.ProductRelevant,
											incentive.QuantityRelevant,
											incentive.CategoryCode
                                    );
								});

								/*
								 * ConditionsType/IncentivesType are what is
								 * displayed in the drop-down menu
								 * Conditions/Incentives are the actual
								 * incentives ConditionsType are basically
								 * unique Conditions
								 * 
								 * IncentiveDefinitions define all the stuff as
								 * an incentive, but it has type 0 - Left Side
								 * (Condition) 1 - Right Side (Incentive)
								 * 
								 * Also, the way they are defined is that there
								 * can be multiple IncentiveDefinitions with the
								 * same Class, so then you add another row and
								 * you'll have a combo with the incentives that
								 * have that class
								 */

								this.content.setProperty("/TermOptions", conditionsType);
								this.content.setProperty("/RewardOptions", rewardOptions);
								this.content.setProperty("/PossibleConditions", conditions);
								this.content.setProperty("/PossibleIncentives", incentives);
							}
						},

						setTermsModel : function(data) {
							var termModel = data.contentModel;
							this.getView().setModel(termModel, "TermsContentModel");
						},
						
						handleLoadItems: function(oEvent){
							var oBinding = oEvent.getSource().getBinding("items");
							oBinding.resume();
							oBinding.checkUpdate(true);
						},

						setOfferData : function(data) {
							this.setStaticData(data);
							this.setTermsData(data);
							this.setupFinancials();
							this.setFinancialData(data.Terms);
							var localData = this.data.getData();
							var terms = localData.Terms;
							var rewards = localData.Rewards;
							
							var allTermsWithProducts = terms.concat(rewards).filter(function(term) {
								return term.Selection.ProductId || term.Selection.HierarchyId || term.Selection.HierarchyNodeId;
							}).filter(function(term) {
								return !term.ForTerm;
							});
							var purposes = this.getView().getModel("TermsContentModel").getProperty("/Purposes");
							this.productDetails.init(allTermsWithProducts, purposes);
							this.productDetails.calculateTotalProducts();
							this.updatePackage(rewardDiscountValue);
						},
		

						getFinancials : function() {
							return this.data.getProperty("/Financials");
						},
						
						getTermsProductsFinancials: function() {
							var termsWithFinancials = this.data.getProperty("/Terms");
							var terms = this.getOfferData().Terms.map(function(term, termIndex) {
								term.TermProducts.forEach(function(prod, prodIndex) {
									prod.Financials = Utils.get(termsWithFinancials, [termIndex, "TermProducts", prodIndex, "Financials"]) || {Id: ""};
								});
								return term;
							});
							return {Terms: terms};
						},

						getOfferData : (function() {
							
							/*
							 * Takes an array and an incentive and adds it in
							 * proper format
							 */
							 var addIncentiveInto = (function() {
								 function transformIncentive(newIncentive, incentive) {
									if (incentive.Selection.ProductId && incentive.ProductRelevant === "X") {
										newIncentive.ProductId = incentive.Selection.ProductId;
									}
									if (incentive.Selection.ExtProductId && incentive.ProductRelevant === "F") {
										newIncentive.ExtProductId = incentive.Selection.ExtProductId;
									}
									// reuse current structure -> map offer id into product id
									if (incentive.Selection.OfferId && (incentive.ProductRelevant === "O01" || incentive.ProductRelevant === "O09")) {
										newIncentive.ProductId = incentive.Selection.OfferId;
									}
									if (incentive.Selection.Quantity) {
										newIncentive.Quantity = parseInt(incentive.Selection.Quantity, 10);
									}
									
 							        for ( var key in incentive.Selection) {
 							            
										if (incentive.Selection.hasOwnProperty(key) && key !== "OfferId") {
											if (incentive.Selection[key] && !newIncentive.hasOwnProperty(key)) {
												newIncentive[key] = incentive.Selection[key] + "";
											}
										}
									}
								}
								 
								/*
								 * Conditions are incentives from the left side.
								 * Incentives are incentives from the right side
								 */
								function getIncentiveInProperFormat(incentive) {
									var newIncentive = {};

									transformIncentive(newIncentive, incentive);
									newIncentive.Id = incentive.IncentiveId || "";
									if(newIncentive.Type && incentive.Class) {
										newIncentive.Class = incentive.Class;	
									}
									return newIncentive;
								}
								
								return function (array, incentive) {
									var newIncentive = getIncentiveInProperFormat(incentive);
									if (Object.keys(newIncentive).length > 1) {
										array.push(newIncentive);
									}
								};
							}());
								
							
							function getStringOrNull(item) {
								if (item) {
									return item + "";
								}
								return null;
							}

							/*
							 * Merge the incentives on the right side into the
							 * incentives on the left side
							 */
							function mergeIncentivesWithTerm(item, reward) {
								/* Iterate over the Incentives and merge them */
								item.Incentives = item.Incentives || [];
								reward.Incentives.forEach(function(incentive) {
									addIncentiveInto(item.Incentives, incentive);
								});
							}

							function getDiscountValue(type, value) {
								if (type === "05" || type === "06") {
									return null;
								}
								if(!parseFloat(value)) {
									value = 0;
								}
								return value + "";
							}

							/* Merges Discount with the item */
							function mergeRewardWithTerm(item, reward) {
								
								if (reward.Selection.DiscountType) {
									item.DiscountType = reward.Selection.DiscountType;
									item.DiscountAssignment = reward.Selection.DiscountAssignment || "0";
									item.SubDiscountType = reward.Selection.DiscountType;
									if (reward.Selection.Dimension !== "01") {
										item.Variety = reward.Selection.Variety || "0";
									}
								}
								
								if (reward.Selection.DiscountValue) {
									item.DiscountValue = getDiscountValue(reward.Selection.DiscountType, reward.Selection.DiscountValue);
								}
								if (reward.Selection.SubDiscountValue) {
									item.SubDiscountValue = getDiscountValue(reward.Selection.DiscountType, reward.Selection.SubDiscountValue);
								}
								if(reward.Type === "03") {
									item.DiscountType = "02";
									delete item.SubDiscountValue;
								}
							}

							/*
							 * Gets the data for terms (left side of the UI) -
							 * the Buy section and transforms it for the server.
							 * 
							 * It returns an array of objects with specific
							 * format
							 * 
							 * Pretty self explanatory, it - filters everything
							 * except nonNull elements - maps each object to a
							 * default standard - adds 'rewards' - this might be
							 * ill named. This step should merge the items on
							 * the right side (Get section) IN the item on the
							 * left side (Buy section) So if we have Reward 1
							 * with type 'For Term X', it should merge IN that
							 * Term X - Strips Identifier - this is just
							 * stripping the ID as the server doesn't need it,
							 * this step should not be necessary, we can just
							 * send a good defaultTerm, but we need it for the
							 * 'addRewards' step (needs reformatting)
							 */
							var getTermsGetOfferData = (function() {
								/*
								 * This is where the term object structure is
								 * defined; Easily modifiable
								 * 
								 * Receives an item from the Terms data in the model
								 * (left side) Returns a basic structure for what
								 * the server needs, which will later be transformed
								 * etc
								 * 
								 */
								function getDefaultTerm(item, index) {
									var result = {
										TermType : "1",
										DimensionType : item.Selection.DimensionType || null,
										DiscountTypeName : item.DiscountTypeLabel,
										UnitOfMeasure : item.Selection.UnitOfMeasure || null,
										Quantity : getStringOrNull(item.Selection.Quantity) || "1",
										MinAmount : getStringOrNull(item.Selection.MinAmount) || "0",
										UserProjection : getStringOrNull(item.Selection.UserProjection) || "0",
										Identifier : item.Identifier,
										TermProducts : [],
										PromoCostPriceCurrency : item.Selection.PromoCostPriceCurrency || item.Currency,
										UoMs : (item.UnitOfMeasures || [{Id : ""}]).map(function(uom){
											return {
												Unit : uom.Id
											};
										})
									};
									
									for (var key in item.Selection) {
										if (item.Selection.hasOwnProperty(key)) {
											if (!result.hasOwnProperty(key) && item.Selection[key]) {
												result[key] = item.Selection[key];
											}
										}
									}
									
									delete result.ForceProductLoad;
									delete result.Type;

									/* Don't add Operator if it is the first item */
									if (index !== 0) {
										var op = this.content.getData().Operators;
										result.Operation = op ? op.Value || "1" : "1"; // Default to "1"
									}

									/* Add incentives in proper format */
									if (item.Conditions && item.Conditions.length) {
										result.Incentives = [];
										item.Conditions.forEach(function(condition) {
											addIncentiveInto(result.Incentives, condition);
										});
									}

									if (result.DimensionType !== "20") {

										if (item.Selection.ProductId) {
											result.ProductId = item.Selection.ProductId;
										}
										if (item.Selection.HierarchyNodeId) {
											result.HierarchyNodeId = item.Selection.HierarchyNodeId;
										}
										if (item.Selection.HierarchyId) {
											result.HierarchyId = item.Selection.HierarchyId;
										}

									}

									if (item.OfferId) {
										result.OfferId = item.OfferId;
									}
									delete result.TermId;
									if (item.TermId && item.TermId.indexOf("Term") === -1) {
										result.TermId = item.TermId;
									}
									if (item.Selection.PromoCostPrice && parseFloat(item.Selection.PromoCostPrice) > 0) {
										result.PromoCostPrice = getStringOrNull(item.Selection.PromoCostPrice);
										result.UsePromoCostPrice = true;
									} else {
										result.UsePromoCostPrice = false;
									}
									var termProducts = this.productDetails.getForTerm(item);

									result.TermProducts = termProducts || [];
									return result;
								}
								
								/* Filter out the null Term Objects */
								function nonNull(item) {
									var hasProduct = item.Selection.ProductId || (item.Selection.HierarchyId && item.Selection.HierarchyNodeId);
									return item.Selection.DimensionType === "20" ? true : !!item.Selection.DimensionType && hasProduct;
								}
								
								/*
								 * Probably ill named; This doesn't really 'adds
								 * rewards' as much as it merges them into something
								 * (into item)
								 * 
								 * Receives an item from the Terms data in the model
								 * Returns the enhanced item
								 */
								function addRewards(rewardsData, item) {
									/*
									 * Rewards can be 'For Term X' or 'For Whole
									 * Offer'
									 */
									rewardsData.forEach(function(reward) {
										/*
										 * If the reward is connected to
										 * some term, merge it into it
										 */
										if (reward.ForTerm && reward.ForTerm.Identifier == item.Identifier) {
											mergeIncentivesWithTerm(item, reward);
											mergeRewardWithTerm(item, reward);
										}
									});

									return item;
								}
								
								function stripIdentifier(item) {
									delete item.Identifier;
									return item;
								}
								
								function removeADiscount(item) {
									if (!item.Type) {
										return false;
									}

									return item.Type !== "01" && item.Type !== "03";
								}
								
								function getDefaultReward(item, index) {
									var result = {
										TermType : "2",
										DimensionType : item.Selection.DimensionType || null,
										UnitOfMeasure : item.Selection.UnitOfMeasure || null,
										DiscountType : item.Selection.DiscountType || "",
										DiscountTypeName : item.DiscountTypeLabel,
										SubDiscountType : item.Selection.DiscountType || "",
										DiscountValue : getDiscountValue(item.Selection.DiscountType, item.Selection.DiscountValue) || "0",
										SubDiscountValue : getDiscountValue(item.Selection.DiscountType, item.Selection.SubDiscountValue) || "0",
										Quantity : getStringOrNull(item.Selection.Quantity) || "1",
										UserProjection : getStringOrNull(item.Selection.UserProjection) || "0",
										PromoCostPrice : getStringOrNull(item.Selection.PromoCostPrice) || "0",
										Financials : {
											Id : ""
										},
										UoMs : (item.UnitOfMeasures || [{Id : ""}] ).map(function(uom){
											return {
												Unit : uom.Id
											};
										})
									};
									for(var key in item.Selection) {
										if (item.Selection.hasOwnProperty(key)) {
											if (!result.hasOwnProperty(key) && item.Selection[key]) {
												result[key] = item.Selection[key];
											}
										}
									}
									
									delete result.ForceProductLoad;
									delete result.Type;
									if (index !== 0) {
										result.Operation = item.Operation || "1";
									}
									if (result.DimensionType !== "20") {
										if (item.Selection.ProductId) {
											result.ProductId = item.Selection.ProductId;
										}
										if (item.Selection.HierarchyNodeId) {
											result.HierarchyNodeId = item.Selection.HierarchyNodeId;
										}
										if (item.Selection.HierarchyId) {
											result.HierarchyId = item.Selection.HierarchyId;
										}

									}
									if (result.DimensionType !== "01") {
										result.Variety = item.Selection.Variety || "0";
									}
									/* Add incentives in proper format */
									if (item.Incentives && item.Incentives.length) {
										result.Incentives = [];
										item.Incentives.forEach(function(condition) {
											addIncentiveInto(result.Incentives, condition);
										});
									}

									var termProducts = this.productDetails.getForTerm(item);
									result.TermProducts = termProducts || [];

									delete result.TermId;
									return result;
								}
								
								return function(self, terms, rewards) {
									var termsForServer = terms.filter(nonNull)
										  .map(getDefaultTerm, self)
										  .map(addRewards.bind(null, rewards))
										  .map(stripIdentifier);

									var rewardsForServer = rewards.filter(removeADiscount).map(getDefaultReward, self);
									
									return termsForServer.concat(rewardsForServer);
								};
							}());

							/*
							 * Receives the Rewards data on the model Returns
							 * the Incentives in good format for the server
							 */
							function getIncentives(rewards) {
								var wholeOfferIncentives = [];
								rewards.forEach(function(reward) {
									var appId = reward.Applicability;
									var app = reward.Applicabilities[appId];
	
									if (!app || (app.Type === "WholeOffer" && !reward.Type)) {
										reward.Incentives.forEach(function(incentive) {
											addIncentiveInto(wholeOfferIncentives, incentive);
										});
									}
								});

								return wholeOfferIncentives;
							}
							
							function getTermsOfferData(termsController){
								var termsData = jQuery.extend(true, [], getTerms(termsController.data));
								var rewardsData = jQuery.extend(true, [], getRewards(termsController.data));
								
								return {
									Terms : getTermsGetOfferData(termsController, termsData, rewardsData),
									Incentives : getIncentives(rewardsData)
								};
							}
							/*
							 * An Offer is represented like this: OfferId: ...
							 * ... Terms: [... some terms], Incentives: [...
							 * some incentives] ... Some other stuff
							 * 
							 * So, items will map to Terms, and Incentives to
							 * Incentives The mapping will be done in a higher
							 * level module, probably in Terms
							 * 
							 * Also, each Reward can have Incentives. If there
							 * are only Incentives for a Reward, and its type is
							 * 'For Whole Offer', they become 'global' and map
							 * to Incentives. If they are not 'global', i.e 'For
							 * Term x', they just map to a Term object.
							 */
							return function () {
								return getTermsOfferData(this);
							};
						}()),
						setRouter : function(router) {
							this.content.setProperty("/Router", router);
							this.productGroupController.setRouter(router);
						},
						processServerErrors : function(aMessages) {
							var oMessageManager = Utils.getMessageManager();
							Utils.setErrorMessages(oMessageManager, aMessages, this.data);
						},

						applyConfigs : (function() {
							function termAt(array, at, textFn) {
								var term = array[at] || createBlankTerm((at + 1) + "", textFn);
								array[at] = term;
								term.SectionConfig = {};
								return term;
							}
							
							function rewardAt(array, terms, at, textFn) {
								var reward = array[at] || createBlankReward((at + 1) + "", textFn);
								reward.Applicabilities = createApplicabilitiesForReward(terms, textFn);
								array[at] = reward;
								reward.SectionConfig = {};
								return reward;
							}
							
							function ruleAt(array, at) {
								return array[at] || {};
							}

							function configFromRule(rule) {
								var config = {};

								var ruleProperty = rule.Property;
								var ruleBoolean = rule.Value === "true" ? false
										: true;
								var ruleValue = rule.Value;

								if (ruleProperty === "readOnly") {
									config.Editable = ruleBoolean;
								}
								if (ruleProperty === "hidden") {
									config.Visible = ruleBoolean;
								}

								if (ruleProperty === "value") {
									config.DefaultValue = ruleValue;
								}

								return config;
							}
							
							function controlsFromRules(rules) {
								return rules.map(function(rule) {
									return rule.Control;
								}).filter(function(item, index, array) {
									return array.indexOf(item) === index;
								});
							}

							function rulesByControl(rules, control) {
								return rules.filter(function(rule) {
									return rule.Control === control;
								});
							}

							function configForControl(rules) {
								var config = {
									DefaultValue : null,
									Editable : true,
									Visible : true
								};

								for (var i = 0; i < rules.length; i++) {
									var rule = ruleAt(rules, i);
									config = jQuery.extend(config, configFromRule(rule));
								}
								return config;
							}

							function configsFor(configs, configName) {
								return configs.filter(function(config) {
									return configName === config.Name;
								});
							}
							
							function sectionConfigs(allRules) {
								var sectionConfig = {};
								var controls = controlsFromRules(allRules);
								for (var j = 0; j < controls.length; j++) {
									var control = controls[j];
									var rules = rulesByControl(allRules, control);
									sectionConfig[control] = configForControl(rules, control);
								}
								return sectionConfig;
							}

							function productLevelSectionItem(sectionItems, type) {
								var defaultResult = {
									SectionItemRules : []
								};
								if (!sectionItems) {
									return [];
								}

								var item = sectionItems.filter(function(item) {
									return item.ItemType === type;
								})[0] || defaultResult;

								return item.SectionItemRules;
							}
							
							function mergeSelectionProps(item) {
								var conf = item.ProductConfig;
								var selection = item.Selection;
								
								var confProductId = (conf.ProductId || {}).DefaultValue;
								var confHierarchyId = (conf.HierarchyId || {}).DefaultValue;
								var confHierarchyNodeId = (conf.HierarchyNodeId || {}).DefaultValue;
								var confDimensionType = (conf.DimensionType || {}).DefaultValue;
								
								//Determine if config is setting one of the product dimensions or dimension type
								var confId = confProductId || confHierarchyNodeId || confHierarchyId || confDimensionType;
								// Determine if there is already deminesion set
								var selectedId = selection.ProductId || selection.HierarchyNodeId || selection.HierarchyId;
								
								//Copy default values if there is no value yet
								//Ignore dimension and dimension type properties
								for ( var selectionKey in item.Selection) {
									if (item.Selection.hasOwnProperty(selectionKey) && 
										item.ProductConfig.hasOwnProperty(selectionKey)) {
										
										if((selectionKey === "ProductId" || selectionKey === "HierarchyNodeId" || selectionKey === "HierarchyId"  || selectionKey === "DimensionType")) {
											continue;
										}
										
										var defaultValue = (item.ProductConfig[selectionKey] || {}).DefaultValue;
										if (defaultValue && defaultValue.trim) {
											defaultValue = defaultValue.trim();
										}
										item.Selection[selectionKey] = item.Selection[selectionKey] || defaultValue;
									}
								}
								item.ForceProductLoad = false;
								
								// Reset item if item is initial and there is config for dimension or dimension type
								if (!selectedId && confId ) {
									item.Selection.ProductId = confProductId || null;
									item.Selection.HierarchyId = confHierarchyId || null;
									item.Selection.HierarchyNodeId = confHierarchyNodeId || null;
									item.Selection.DimensionType = (conf.DimensionType || {}).DefaultValue || null;
									item.Selection.ForceProductLoad = true;
								}								
							}

							function mergeType(item) {
								if(item.Type === "01") {
									var selcetion = item.Selection;
									var oldType = null;
									if(selcetion.ProductId || selcetion.HierarchyId || selcetion.HierarchyNodeId){ //use existing type if we have data
										oldType = selcetion.DimensionType || (item.ProductConfig.DimensionType || {}).DefaultValue;
									}else {// default if not
										oldType = (item.ProductConfig.DimensionType || {}).DefaultValue;
									}
									item.Type = oldType || "01";
									item.Selection.DimensionType = item.Type; 
								} else {
									item.Type = item.Type || (item.ProductConfig.DimensionType || {}).DefaultValue;
									item.Selection.DimensionType = item.Selection.DimensionType || (item.ProductConfig.DimensionType || {}).DefaultValue || "01";
								} 
							}

							function applicabilityById(id){
								return function(x){ 
									return x.Id === id || x.Id + "" === id; 
								};
							}
							function loadedFromServer(rewardItem){
								return !!(rewardItem.TermId || rewardItem.RewardId);
							}
							function recaltulateApplicability(rewardItem, termsData) {
								var linkedTermValue = (rewardItem.ProductConfig.RewardScope || {}).DefaultValue;
								var applicabilities = rewardItem.Applicabilities;
								if (linkedTermValue && !loadedFromServer(rewardItem)) {
									var linkedTermParsedValue = parseInt(linkedTermValue, 10);
									var term = termsData.filter(function(item) {
										return item.Index === linkedTermValue || item.Index === linkedTermParsedValue;
									})[0]; 
									setupLinksBetweenTermAndReward(rewardItem, {
										Term : term
									});

									var applicabilityForReward = applicabilities.filter(function(applicability) {
										return !!applicability.Term;
									}).filter(function(applicability) {
										return applicability.Term === rewardItem.ForTerm;
									})[0];

									if (applicabilityForReward) {
										rewardItem.Applicability = applicabilityForReward.Id + "";
										rewardItem.ApplicabilityName = rewardItem.Applicabilities[applicabilityForReward.Id].Name;
									}
								}
							}
							
							function setupRewardApplicability(rewardItem, termsData) {
								var linkedTermValue = (rewardItem.ProductConfig.RewardScope || {}).DefaultValue;
								var applicabilities = rewardItem.Applicabilities;
								if (linkedTermValue && !loadedFromServer(rewardItem)) {
									var linkedTermParsedValue = parseInt(
											linkedTermValue, 10);

									setupLinksBetweenTermAndReward(rewardItem, {
										Term : termsData.filter(function(item) {
											return item.Index === linkedTermValue || 
												item.Index === linkedTermParsedValue;
										})[0]
									});

									var applicabilityForReward = applicabilities.filter(function(applicability) {
										return !!applicability.Term;
									}).filter(function(applicability) {
										return applicability.Term === rewardItem.ForTerm;
									})[0];

									if (applicabilityForReward) {
										rewardItem.Applicability = applicabilityForReward.Id + "";
										rewardItem.ApplicabilityName = applicabilityForReward.Name;
									}
								} else if(applicabilities.filter(applicabilityById(rewardItem.Applicability)).length <= 0){
									//if it applies to something valid, do nothing
									rewardItem.Applicability = rewardItem.Applicabilities[rewardItem.Applicabilities.length - 1].Id;	
								}else if(linkedTermValue == ""){
									//else default the applicability to "whole offer" - which is the last entry
									rewardItem.Applicability = (applicabilities.length - 1);
								}
								if(!loadedFromServer(rewardItem)){ // is not loaded from server
									determineRewardType(rewardItem);
								}else{
									var rewardApp = applicabilities.filter(applicabilityById(rewardItem.Applicability ))[0];
									if(rewardApp instanceof Types.RewardApplicabilityWholeOffer){
										rewardItem.isWholeOffer = true;
										rewardItem.Type = "02";
									}
								}
							}
							function setupSubConditions(incentiveCondition, id) {

								if (incentiveCondition.SubConditions) {
									for (var j = 0; j < incentiveCondition.SubConditions.length; j++) {
										if (incentiveCondition.SubConditions[j].Id === id) {
											var props = incentiveCondition.SubConditions[j].SubConditionsProps
													|| {};
											var isProdRelevant = props.isProductRelevant;
											var isQuantityRelevant = props.isQuantityRelevant;
											var categoryCode = props.CategoryCode;

											incentiveCondition.ProductRelevant = isProdRelevant;
											if (isProdRelevant === "O" && (categoryCode === "01" || categoryCode === "09")) {
											    incentiveCondition.ProductRelevant = isProdRelevant + categoryCode;
											}
											incentiveCondition.QuantityRelevant = isQuantityRelevant;
											return;
										}
									}
								}
							}

							function setupSubIncentives(incentiveCondition, id) {
								if (incentiveCondition.SubIncentives) {
									for (var j = 0; j < incentiveCondition.SubIncentives.length; j++) {
										if (incentiveCondition.SubIncentives[j].Id === id) {
											var props = incentiveCondition.SubIncentives[j].SubIncentivesProps || {};
											var isProdRelevant = props.isProductRelevant;
											var isQuantityRelevant = props.isQuantityRelevant;
											var categoryCode = props.CategoryCode;
											incentiveCondition.ProductRelevant = isProdRelevant;
											if (isProdRelevant === "O" && (categoryCode === "01" || categoryCode === "09")) {
											    incentiveCondition.ProductRelevant = isProdRelevant + categoryCode;
											}
											incentiveCondition.QuantityRelevant = isQuantityRelevant;
											return;
										}
									}
								}
							}
							
							function determineRewardType(rewardItem) {
								var prodConfig = rewardItem.ProductConfig;
								if (Object.keys(prodConfig).length) {
									var rewardScope = prodConfig.RewardScope || {};
									if (rewardScope.DefaultValue) {
										rewardItem.Type = "01";
									} else {
										rewardItem.Type = "02";
										if (rewardItem.Selection) {
											rewardItem.Selection.DimensionType = rewardItem.Selection.DimensionType || "01";
										}
									}
								}
							}
							
							function conditionAt(array, at, clazz, params) {
								var condition = array[at] || createBlankCondition(params.termOptions, params.possibleConditions, clazz);
								array[at] = condition;
								condition.Config = {};
								return condition;
							}
							function incentiveAt(array, at, clazz, params) {
								var condition = array[at] || createBlankIncentive(params.rewardOptions, params.possibleIncentives, clazz);
								array[at] = condition;
								condition.Config = {};
								return condition;
							}
							function configureIncentives(termConfig, termItem, incentiveFetcher, params, prop, selectedProp) {
								var incentiveSectionRules = (termConfig.SectionItems || []).filter(function(item) {
									return item.ItemType === "Incentive";
								});

								for (var i = 0, incentiveIndex = 0; i < incentiveSectionRules.length; i++) {
									var incentiveRuleItem = incentiveSectionRules[i];
									var incentiveSectionConfig = sectionConfigs(incentiveRuleItem.SectionItemRules);
									if (incentiveSectionConfig.hasOwnProperty("Class")) {

										var classValue = incentiveSectionConfig.Class.DefaultValue;
										var incentiveCondition = incentiveFetcher(termItem[prop], incentiveIndex, classValue, params);

										incentiveCondition.Config = incentiveSectionConfig;
										if(!incentiveCondition.Selection) {
											incentiveCondition.Selection = {};
										}
											
										incentiveCondition.Selection.Type = (incentiveSectionConfig.Type || {}).DefaultValue || incentiveCondition.Selection.Type;
										incentiveCondition.Selection.Cost = (incentiveSectionConfig.Cost || {}).DefaultValue || incentiveCondition.Selection.Cost || incentiveCondition.Selection.Cost;
										incentiveCondition.Selection.AdjustedCost = (incentiveSectionConfig.AdjustedCost || {}).DefaultValue || incentiveCondition.Selection.AdjustedCost;
										incentiveCondition.Selection.Value = (incentiveSectionConfig.Value || {}).DefaultValue || incentiveCondition.Selection.Value;
										incentiveCondition.Selection.AdjustedValue = (incentiveSectionConfig.AdjustedValue || {}).DefaultValue || incentiveCondition.Selection.AdjustedValue;
										incentiveCondition.Selection.RedemptionRate = (incentiveSectionConfig.RedemptionRate || {}).DefaultValue || incentiveCondition.Selection.RedemptionRate;

										setupSubConditions(incentiveCondition, incentiveCondition.Selection.Type);
										setupSubIncentives(incentiveCondition, incentiveCondition.Selection.Type);

										incentiveIndex += 1;
									}
								}
							}
							
							function applyTermConfig(oTermItem, oTermConfig, oParameters, oProductDimensions){
								var aRules = oTermConfig.Rules || [];
								var aProductSectionRules = productLevelSectionItem(oTermConfig.SectionItems, "Buy");
								
								oTermItem.Index = oTermConfig.Index;
								oTermItem.SectionConfig = sectionConfigs(aRules);
								oTermItem.ProductConfig = sectionConfigs(aProductSectionRules);
								configureIncentives(oTermConfig, oTermItem, conditionAt, oParameters, "Conditions", "SelectedSubCondition");
	
								mergeSelectionProps(oTermItem);
								mergeType(oTermItem);
								
								oTermItem.DimensionTypeText = mapDimTypeToDimText(oTermItem.Selection.DimensionType, oProductDimensions);
							}
							
							function applyRewardConfig(oRewardItem, oRewardConfig, oParameters, oProductDimensions, aTermData, oContext){
								var rewardRules = oRewardConfig.Rules || [];
								var rewardProductSectionRules = productLevelSectionItem(oRewardConfig.SectionItems, "Get");
								
								oRewardItem.SectionConfig = sectionConfigs(rewardRules);
								oRewardItem.ProductConfig = sectionConfigs(rewardProductSectionRules);
								mergeSelectionProps(oRewardItem);
								setupRewardApplicability(oRewardItem, aTermData);
								configureIncentives(oRewardConfig, oRewardItem, incentiveAt, oParameters, "Incentives");
								oRewardItem.DimensionTypeText = mapDimTypeToDimText(oRewardItem.Selection.DimensionType, oProductDimensions);
								
								//adds reward scope from incentives in case this is an incentive only reward.
								if(!oRewardItem.ProductConfig.RewardScope){
									var incetiveRewardScopes = productLevelSectionItem(oRewardConfig.SectionItems, "Incentive");
									var onlyRewardScopes = incetiveRewardScopes.filter(function(item){
										return item.Control === "RewardScope";
									});
									jQuery.extend(oRewardItem.ProductConfig, sectionConfigs(onlyRewardScopes));
									// force to recalculate applicability 
									recaltulateApplicability(oRewardItem, aTermData);
								}
								
								//recalculate reward options
								if(oRewardItem.Applicabilities && oRewardItem.Applicabilities[oRewardItem.Applicability]) {
									oContext.setupLinkForReward(oRewardItem, oRewardItem.Applicabilities[oRewardItem.Applicability]);
								}
							}
							
							return function(configs) {
								var textFn = this.getText.bind(this);
								var data = this.data.getData();
								var termsData = data.Terms;
								var rewardsData = data.Rewards;
								var params = {
									termOptions: this.content.getProperty("/TermOptions"),
									rewardOptions: this.content.getProperty("/RewardOptions"),
									possibleConditions: this.content.getProperty("/PossibleConditions"),
									possibleIncentives: this.content.getProperty("/PossibleIncentives")	
								};
								var productDimensions = this.content.getProperty("/ProductDimensionsSet");

								// Terms Section
								this._oLastTermTemplate = null;
								var aTermConfigs = configsFor(configs, "Condition");
								// Loop over all Term Configs	
								for (var configIndex = 0; configIndex < aTermConfigs.length; configIndex++) {
									var	oTermConfig = aTermConfigs[configIndex];
									// If it is the last config and we have additional terms, we apply this config to all additional terms (Open/Save scenario)
									if(configIndex == (aTermConfigs.length - 1) && termsData.length > aTermConfigs.length){
										for(var i = configIndex; i < termsData.length; i++){
											var oTermItem = termAt(termsData, i, textFn);
											applyTermConfig(oTermItem, oTermConfig, params, productDimensions);
										}
									}else{
										oTermItem = termAt(termsData, configIndex, textFn);
										applyTermConfig(oTermItem, oTermConfig, params, productDimensions);
									}
									// Save the last Template to apply it to additional terms
									this._oLastTermTemplate = jQuery.extend(true, {}, oTermItem);
								}
								
								// Rewards Section
								this._oRewardTemplate = null;
								var rewardConfigs = configsFor(configs, "Reward");
								// Loop over all Term Configs	
								for (var rewardConfigIndex = 0; rewardConfigIndex < rewardConfigs.length; rewardConfigIndex++) {
									var oRewardConfig = rewardConfigs[rewardConfigIndex];
									
									// If it is the last config and we have additional rewards, we apply this config to all additional rewards (Open/Save scenario)
									if(rewardConfigIndex == (rewardConfigs.length - 1) && rewardsData.length > rewardConfigs.length){
										for(var j = rewardConfigIndex; j < rewardsData.length; j++){
											var oRewardItem = rewardAt(rewardsData, termsData, j, textFn);
											applyRewardConfig(oRewardItem, oRewardConfig, params, productDimensions, termsData, this);
										}
									}else{
										oRewardItem = rewardAt(rewardsData, termsData, rewardConfigIndex, textFn);
										applyRewardConfig(oRewardItem, oRewardConfig, params, productDimensions, termsData, this);
									}

									this._oRewardTemplate = jQuery.extend(true, {}, oRewardItem);
								}

								// Header Section
								var headerConfig = configsFor(configs, "Header")[0] || { Rules : [] };
								var headerRules = headerConfig.Rules || [];
								
								data.Header = {
									SectionConfig : sectionConfigs(headerRules)
								};
								if (typeof(this.content.getProperty("/Operators/Value")) !== "undefined") {
									if(data.Terms.length > 1 && data.Terms[1].Selection && data.Terms[1].Selection.Operation){
										this.content.setProperty("/Operators/Value", data.Terms[1].Selection.Operation);
									}else{
										this.content.setProperty("/Operators/Value", (data.Header.SectionConfig.AndOrSwitch || { DefaultValue : "1" }).DefaultValue);
									}
								}
								else{
									this.content.setProperty("/Operators/Value", (data.Header.SectionConfig.AndOrSwitch || { DefaultValue : "1" }).DefaultValue);
								}

								if (!data.Financials || data.Financials.length <= 0) {
									this.setupFinancials();
								}

								this.updateTermsLabel();
								refreshModel(this.data, true);
							};
						}()),
						
						updateEnforceMultiple: function(enforceMultiple) {
							var bEnable = enforceMultiple === "I";
							if(!bEnable) {
								var terms = this.data.getProperty("/Terms");
								var rewards = this.data.getProperty("/Rewards");
								terms.forEach(function(term) {
									term.Selection.SubDiscountValue = null;
									this.productDetails.update(term, "SubDiscountValue", null);	
								}, this);
								
								rewards.forEach(function(reward) {
									reward.Selection.SubDiscountValue = null;
									this.productDetails.update(reward, "SubDiscountValue", null);	
								}, this);
								refreshModel(this.data);
							}
						},
						
						validateCombo : function(oComboBox, sPath) {
							var sValue = oComboBox.getValue();
							sPath = oComboBox.getBindingContext().getPath()
									+ sPath;
							Utils.removeMessagesByPath(sPath);
							if (!sValue) {
								return false;
							}

							var getErrorMessage = function(sType, iIndex) {
								var i18n = Utils.getI18NModel()
										.getResourceBundle();
								var sMessage = i18n.getText("CreateOffer.Terms.InvalidEntry.Title");
								var sDescription = "";
								switch (sType) {
								case "Terms":
									sDescription = i18n
											.getText("CreateOffer.Terms.InvalidEntry.Description", iIndex);
									break;
								case "Rewards":
									sDescription = i18n.getText("CreateOffer.Terms.Reward.InvalidEntry.Description", iIndex);
									break;
								}
								return {
									message : sMessage,
									description : sDescription
								};
							};

							var sSelectedKey = oComboBox
									.getProperty("selectedKey");
							if (!sSelectedKey) {
								var aPathParts = sPath.split("/");
								var sType = aPathParts[1];
								var iIndex = aPathParts[2];
								iIndex = parseInt(iIndex, 10) + 1;

								var oMessageManager = Utils.getMessageManager();
								var oMessage = getErrorMessage(sType, iIndex);
								var aMessages = [ {
									message : oMessage.message,
									description : oMessage.description,
									type : "Error",
									target : sPath,
									processor : oComboBox.getBindingContext()
											.getModel()
								} ];
								Utils.setErrorMessages(oMessageManager,
										aMessages);
								
								return false;
							}
							
							return true;
						},
						discountTypeChanged : function(oEvent) {
							var oComboBox = oEvent.getSource();
							var term = objectFromEvent(oEvent);
							
							//Refresh discount values 
							term.Selection.DiscountValue = null;
							term.Selection.SubDiscountValue = null;
							
							this.updateDiscountDescription(term);
							var linkedTerm = term;
							if (!term.isWholeOffer && term.ForTerm) {
								term = term.ForTerm;
							}
							
							// Refresh product details
							term.DiscountTypeLabel = oComboBox.getValue();
							term.DiscountType = linkedTerm.Selection.DiscountType;
							term.DiscountValue = linkedTerm.Selection.DiscountValue;
							term.SubDiscountValue = linkedTerm.Selection.SubDiscountValue;
							this.productDetails.update(term, "DiscountTypeLabel", term.DiscountTypeLabel);
							this.productDetails.update(term, "DiscountType", term.DiscountType);
							this.productDetails.update(term, "DiscountValue", null);									
							this.productDetails.update(term, "SubDiscountValue", null);

							this.validateCombo(oComboBox, "/Selection/DiscountType");
							//clear product details discount + subdiscount errors
							var indincesOfProductDetails = this.productDetails.getIndicesForTerm(term);
							
							indincesOfProductDetails.forEach(function(indexOfProductDetail){
								var path = "/ProductDetails/" + indexOfProductDetail;
								var discountPath = path + "/DiscountValue";
								var subDiscountPath = path + "/SubDiscountValue";
								Utils.removeMessagesByPath(discountPath);
								Utils.removeMessagesByPath(subDiscountPath);
							});
							
						},
						onSubConditionChange : function(oEvent) {
							var oComboBox = oEvent.getSource();
							this.validateCombo(oComboBox, "/Selection/Type");
						},
						onUoMValueChanged : function(event){
							var comboBox = event.getSource();
							var bValid = this.validateCombo(comboBox, "/Selection/UnitOfMeasure");
							if (bValid) {
								this.updateProductDetails(event, "PromotedUoM");
							}
						},
						onPromoCostPriceCurrencyChanged : function(event){
							var comboBox = event.getSource();
							var bValid = this.validateCombo(comboBox, "/Selection/PromoCostPriceCurrency");
							if (bValid) {
								this.updateProductDetails(event, "PromoCostPriceCurrency");
							}
						},						
						onSubIncentiveChange : function(oEvent) {
							var oComboBox = oEvent.getSource();
							this.validateCombo(oComboBox, "/Selection/Type");
						},
						onProductDimensionChange : function(oEvent) {
							var term = objectFromEvent(oEvent);
							var oComboBox = oEvent.getSource();
							this.updateDiscountDescription(term);
							this.validateCombo(oComboBox,
								"/Selection/DimensionType");							
							this.productDetails.remove(term);
							this.productDimensionChanged(oEvent);
							//data refresh needs to happen
							//when switching to dimension type "12" (Display Product)
							//PromoCostPrice is not visible
							//the "See More" link not be visible either becasue it only contains the promo cost price
							//we need to retrigger the formatter that determines the visibily of the See More link
							//the only non intrisive way to do this is to refresh the model
							//this causes the whole thing to be a bit slower (not noticeable, but logicaly it makes sence for it to be slower)
							//but does not change any other state
							
							refreshModel(this.data);
						},
						onDiscountAssignmentChange : function(oEvent) {
							var oComboBox = oEvent.getSource();
							this.validateCombo(oComboBox,
									"/Selection/DiscountAssignment");
						},
						onDiscountVarietyChange : function(oEvent) {
							var oComboBox = oEvent.getSource();
							this.validateCombo(oComboBox, "/Selection/Variety");
						},
						toggleVisibity : function(e) {
							var object = e.getSource().getBindingContext()
									.getObject();

							object.More = object.More || {};
							object.More.Visible = !object.More.Visible;
							refreshModel(this.data);
						},
						
						updateProductDetails : function(oEvent, property) {
							var term = objectFromEvent(oEvent);
							if (!term.isWholeOffer && term.ForTerm) {
								term = term.ForTerm;
							}
							var value = oEvent.getParameter("newValue");
							if (value) {
								value = value.replace(",", ".");
							}
							
							this.productDetails.update(term, property, value);
							return value;
						},
						updateDiscountDescription : function(term) {
							var that = this;
							var originalTerm = term;
							if (term.Selection.DiscountType === "04") {
								originalTerm.DiscountDescription = "%";
							} else {
								var id = term.Selection.ProductId
										|| term.Selection.HierarchyNodeId
										|| term.Selection.HiearchyId;
								var dimension = term.Selection.DimensionType;
								var hasValidProduct = !!id && !!dimension;
								if (hasValidProduct) {
									Models
											.getProductById(id, dimension)
											.then(
													function(product) {
														originalTerm.DiscountDescription = product.ProductDetail.Currency;
														refreshModel(that.data);
													});
								} else {
									originalTerm.DiscountDescription = null;
								}
							}
						},
						genericHandler : function(oEvent, validationString,
								inputPath) {
							var isError = Utils.validationHandler(
									validationString, oEvent, inputPath,
									this.data.getData(), this.data);
							if (oEvent.getParameter("dimensionTrigger")
									&& isError) {
								oEvent.getSource().setValue("");
								var path = oEvent.getSource()
										.getBindingContext().sPath
										+ inputPath;
								Utils.removeMessagesByPath(path);
							}
						},
						handleSelectedSubIncentiveExtProductId : function(
								oEvent) {
							this.genericHandler(oEvent, "emptyValidation",
									"/Selection/ExtProductId");
						},
						handleSelectedSubIncentiveQuantity : function(oEvent) {
							this.genericHandler(oEvent, "numericValidation",
									"/Selection/Quantity");
						},
						handleSelectionQuantity : function(oEvent) {
							this.genericHandler(oEvent, "numericValidation",
									"/Selection/Quantity");
						},
						handleSelectionQuantityChange: function(oEvent) {
							var isError = Utils.validationHandler("numericValidation", oEvent, "/Selection/Quantity", this.data.getData(), this.data);
							if(!isError) {
								this.updatePackageAppropiation();
								this.updatePackageUserProjection();
							}
						},
						handleSelectionMinAmount : function(oEvent) {
							this.genericHandler(oEvent, "minAmountValidation",
									"/Selection/MinAmount");
						},
						handleSelectionUserProjection : function(oEvent) {
							this.genericHandler(oEvent,
									"greaterOrEqualValidation",
									"/Selection/UserProjection");
						},
						handleSelectionPromoCostPrice : function(oEvent) {
							this.genericHandler(oEvent,
									"greaterOrEqualValidationWithMax",
									"/Selection/PromoCostPrice");
						},
						handleSelectionDiscountValue : function(oEvent) {
							this.genericHandler(oEvent,
									"minDiscountValidation",
									"/Selection/DiscountValue");
							
						},
						handleSelectionSubDiscountValue : function(oEvent) {
							this.genericHandler(oEvent,
									"minDiscountValidation",
									"/Selection/SubDiscountValue");
						},
						handleSelectedSubIncentiveCost : function(oEvent) {
							this.genericHandler(oEvent,
									"greaterOrEqualValidation",
									"/Selection/Cost");
						},
						handleSelectedSubIncentiveAdjustedCost : function(
								oEvent) {
							this.genericHandler(oEvent,
									"greaterOrEqualValidation",
									"/Selection/AdjustedCost");
						},
						handleSelectedSubIncentiveValue : function(oEvent) {
							this.genericHandler(oEvent,
									"greaterOrEqualValidation",
									"/Selection/Value");
						},
						handleSelectedSubIncentiveAdjustedValue : function(
								oEvent) {
							this.genericHandler(oEvent,
									"greaterOrEqualValidation",
									"/Selection/AdjustedValue");
						},
						handleSelectedSubIncentiveRedemptionRate : function(
								oEvent) {
							this.genericHandler(oEvent, "rangeValidation",
									"/Selection/RedemptionRate");
						},
						triggerDimensionValidation : function(oEvent) {

							var getFormContainer = function() {
								var toReturn = null;
								var formContainer = oEvent.getSource()
										.getParent().getParent();

								if (formContainer.getMetadata().getName()
										.indexOf("FormContainer") > -1
										&& formContainer.getVisible()) {
									toReturn = formContainer;
								} else {

									var items = formContainer
											.getAggregation("items");
									var form = null;
									for (var i = 0, iLen = items.length; i < iLen; i++) {
										if (items[i]
												.getMetadata()
												.getName()
												.indexOf(
														"sap.ui.layout.form.Form") > -1) {
											form = items[i];
										}
									}

									if (form) {
										var itemContainers = form
												.getAggregation("formContainers");
										for (var j = 0, jLen = itemContainers.length; j < jLen; j++) {
											if (itemContainers[j]
													.getMetadata()
													.getName()
													.indexOf(
															"sap.ui.layout.form.FormContainer") > -1
													&& itemContainers[j]
															.getVisible()) {
												toReturn = itemContainers[j];
											}
										}
									}
								}

								return toReturn;
							};

							var inputSearch = function() {
								var formElements = formContainer
										.getAggregation("formElements");
								for (var i = 0, iLen = formElements.length; i < iLen; i++) {

									var formElement = formElements[i]
											.getAggregation("fields");
									if (formElement.length > 0) {

										for (var j = 0, jLen = formElement.length; j < jLen; j++) {
											var input = formElement[j]
													.getMetadata().getName()
													.indexOf("Input") > -1 ? formElement[j]
													: null;

											if (input && input.getVisible()) {
												var inputValue = input
														.getValue();
												triggerInput(input, inputValue);
											}
										}
									}
								}
							};

							var triggerInput = function(input, value) {
								input.fireLiveChange({
									value : value,
									dimensionTrigger : true
								});
							};

							var formContainer = getFormContainer();
							inputSearch();
						},
						openQuickView: function(oEvent) {
							function createDiscountDescription(parentTerm){
								var term = jQuery.extend(true, {}, parentTerm);
								term.DiscountDescription = "";
								if(term.DiscountType === "04"){
									term.DiscountDescription = "%";
									
								}else if(term.DiscountType === "05" || term.DiscountType === "06"){
									term.DiscountValue = null;
								}
								return  ((term.DiscountValue || term.Selection.DiscountValue) || 0).toString().concat(" ").concat(term.DiscountDescription);
							}
							
							function createParentTermData(context, parentTerm) {
								return {
									Items : [
											{
												label : parentTerm.DimensionTypeText,
												text : parentTerm.ProductTextValue + " - " + parentTerm.ProductDescriptionValue
											},
											{
												label : "{i18n>CreateOffer.Terms.Freestyle.QuantityAndUnitOfMeasure}",
												text : (parentTerm.Selection.Quantity || "0")
														+ " / "
														+ parentTerm.Selection.UnitOfMeasure
											},
											{
												label : "{i18n>CreateOffer.Terms.FreestyleOffer.DiscountType}",
												text : parentTerm.DiscountTypeLabel || "-"
											},
											{
												label : "{i18n>CreateOffer.Terms.FreestyleOffer.DiscountValue}",
												text : createDiscountDescription(parentTerm)
											} ]
								};
							}

							var oQuickView = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.terms.styles.QuickViewTerm", {
								afterClose: function() {
									this.destroy();
								}
							});
							var model = new JSONModel({});
							var productDetail = this.data.getProperty(oEvent.getSource().getParent().getBindingContext().getPath());
							var aTermsfinancials = this.data.getProperty("/TermFinancialFields").filter(function(term) {
								return term.TermType + "-" + term.Identifier === productDetail.ParentId;
							})[0];
							var financials = aTermsfinancials.Items.map(function(financial){
								financial.label = financial.label.replace(":", "");
								return financial;
							});
							var termId = aTermsfinancials.TermType + "-" + aTermsfinancials.Identifier;

							var allTerms = this.data.getProperty("/Terms").concat(this.data.getProperty("/Rewards"));

							var parentTerm = allTerms.filter(function(term) {
								return term.TermType + "-" + term.Identifier === termId;
							})[0];
							var parentTermData = createParentTermData(this, parentTerm);
							
					
							model.setData({
								Financials: financials,
								Term: parentTermData
							});
							oQuickView.setModel(model);
							oQuickView.setModel(Utils.getI18NModel(), "i18n");
							oQuickView.setModel(this.getView().getModel("featuresAvailable"), "featuresAvailable");
							
							oQuickView.openBy(oEvent.getSource());
						},
						
						onLocationSubGroupsChecked: function(oEvent){
							var data = oEvent.getParameter("object");
							var name = oEvent.getParameter("name");
							var selected = oEvent.getParameter("selected");
							this.productDetails.subGroupChecked({
								data: data,
								name: name,
								selected: selected
							});
							
						},
						
						hideProducts: function(oEvent) {
							var sPaths = oEvent.getParameter("selectedPaths") || [];
							var options = {
			   					view : this.getView(),
			   					title : "{i18n>CreateOffer.HideProductTitle}",
			   					message : sPaths.length > 1 ? "{i18n>CreateOffer.OfferHideProductsDialogDescription}" :  "{i18n>CreateOffer.OfferHideProductDialogDescription}",
			   					state : "Warning",
			   					btnOk : "{i18n>ManageOffers.ProductDetails.Hide}",
			   					btnCancel : "{i18n>CreateOffer.CreateOfferDialog.Reject}",
			   					onOk : function(resolve) { resolve(); },
					   			onCancel : function(resolve, reject) { reject(); }
				   			};
							
							var terms = this.data.getProperty("/Terms");
							var rewards = this.data.getProperty("/Rewards");
							var that = this;
							Utils.createDialogUtil(options).then(function(){
					   			var selections = sPaths.map(function(path) {
									var detail = that.data.getProperty(path);
									var index = parseInt(path.match(/\d+$/)[0], 10);
									return jQuery.extend(true, { Index : index }, detail );
								});
					   			
					   			var update = function(term) {
									var termProdObj = (term.TermProducts || []).reduce(function(result, prod) {
										var id = prod.ProductId || prod.HierarchyNodeId || prod.HierarchyId;
										result[id] = prod;
										return result;
									}, {});
									selections.forEach(function(selection) {
										var idSelProd = selection.ProductId || selection.HierarchyNodeId || selection.HierarchyId;
										selection.Visibility = "-";
										
										if(termProdObj[idSelProd]) {
											termProdObj[idSelProd].Visibility = "-";
											
										}
									});
									term.TermProducts = Object.keys(termProdObj).map(function(prodId) {
										return termProdObj[prodId];
									});
								};
								
								terms.forEach(update);
								rewards.forEach(update);
								
								that.productDetails.hideProducts(selections);
								var table = that.getView().byId("productDetailsTable");
								table.clearSelection();
					   		});
						},
						
						addMoreProducts: function(oEvent) {
							var selections = [];
							if (oEvent.getId() === "select") {
								// fire event when check/uncheck the Visible column of product details table
								var isProdVisible = oEvent.getParameter("selected");
								var sProdPath = oEvent.getSource().getBindingContext().getPath();
								var oProdDetail = this.data.getProperty(sProdPath);
								var idProdDetail = oProdDetail.ProductId || oProdDetail.HierarchyNodeId || oProdDetail.HierarchyId;
							}
							else {
								// fire event from Add More Product link
								selections = oEvent.getParameter("selections") || [];
							}
							var terms = this.data.getProperty("/Terms");
							var rewards = (this.data.getProperty("/Rewards") || []).filter(function(reward){
								return reward.isWholeOffer;
							});
							var that = this;
							var update = function(term) {
								var item = term.Selection;
								var id = item.ProductId || item.HierarchyNodeId || item.HierarchyId;
								if(!id) {
									return;
								}
								var key = item.DimensionType + "#" +  Utils.base64ToHex(id);
								// about selections[key] - when fire event from Show More Product link,  
								// it should have been created already from SmartproductDetails.js
								// it does not exist when fire event from check/uncheck of visible column
								if(!selections[key]) {
									if (oProdDetail) {
										selections[key] = { Products: [] };
										selections[key].Products.push(oProdDetail);
									} else {
										return;
									}
								}
								var termProdObj = (that.productDetails.getForTermData(term) || []).reduce(function(result, prod) {
									var idProduct = prod.ProductId || prod.HierarchyNodeId || prod.HierarchyId;
									result[idProduct] = prod;
									return result;
								}, {});
								selections[key].Products.forEach(function(selection) {
									var idSelProd = selection.ProductId || selection.HierarchyNodeId || selection.HierarchyId;
									
									if (termProdObj[idSelProd]) {
									   termProdObj[idSelProd].Visibility = "+";
									} else {
									   selection.Visibility = "+";
									   termProdObj[idSelProd] = selection;
									}
									// override if fire event from visible column for un-check
									if (idProdDetail && idProdDetail === idSelProd && !isProdVisible) {
										termProdObj[idSelProd].Visibility = "";
									}
								});
								term.TermProducts = Object.keys(termProdObj).map(function(prodId) {
									return termProdObj[prodId];
								});
								// redo product details only when fire event from show More Products
								if (!idProdDetail) {
									that.productDetails.remove(jQuery.extend(true, {}, term));
									that.productDetails.add(term.TermProducts, term);
								}
							};
							terms.forEach(update);
							rewards.forEach(update);
						},
						
						openDetailsMassEditDialog : function(e){
							
							var that = this;
							var sPaths = e.getParameter("selectedPaths") || [];
							var selection = sPaths.map(function(path){
								var detail = that.data.getProperty(path);
								var index = parseInt(path.match(/\d+$/)[0], 10);
								return jQuery.extend(true, { Index : index }, detail );
							});
							if (selection.length > 0) { selection.CurrencyList = this.content.getProperty("/CurrencyList"); };
							var enforceMultiple = this.getView().getModel("TermsContentModel").getProperty("/EnforceMultipleValue");
							return new ProductDetailsMassChange(this.productDetails, selection, this.productDetailsEditableFields(), enforceMultiple).openDialog();
						},
						productDetailsEditableFields : function(){
							return ["DiscountValue", "SubDiscountValue", "DisplayUoM", "LockUserProjection", "UserProjection", "DisplayUoMValue", "PromotedUoM", "PromoCostPrice", "PromoCostPriceCurrency"];
						},
						validateProductDetailsUserProjection : function(e){
							var object = objectFromEvent(e);
							this.productDetails.validateItem(object, "UserProjection");
						},
						validateProductDetailsDisplayUoMValue : function(e){
							var object = objectFromEvent(e);
							this.productDetails.validateItem(object, "DisplayUoMValue");
						},
						validateProductDetailsPromoCostPrice : function(e){
							var object = objectFromEvent(e);
							this.productDetails.validateItem(object, "PromoCostPrice");
						},
						validateProductDetailsPromoCostPriceCurrency : function(e){
							var object = objectFromEvent(e);
							var sErrorMessage = this.productDetails.validateItem(object, "PromoCostPriceCurrency");
							var oInput = e.getSource();
							if (sErrorMessage != ""){
								oInput.setValueState(sap.ui.core.ValueState.Error);
								oInput.setValueStateText(sErrorMessage);
							}else{
								oInput.setValueState(sap.ui.core.ValueState.None);
								oInput.setValueStateText("");
							}
						},
						validateProductDetailsDisplayUoM : function(e){
							var object = objectFromEvent(e);
							var sErrorMessage = this.productDetails.validateItem(object, "DisplayUoM");
							var oInput = e.getSource();
							if (sErrorMessage != ""){
								oInput.setValueState(sap.ui.core.ValueState.Error);
								oInput.setValueStateText(sErrorMessage);
							}else{
								oInput.setValueState(sap.ui.core.ValueState.None);
								oInput.setValueStateText("");
							}
						},
						validateProductDetailsPromotedUoM : function(e){
							var object = objectFromEvent(e);
							var sErrorMessage = this.productDetails.validateItem(object, "PromotedUoM");
							var	oInput = e.getSource();
							if (sErrorMessage != ""){
								oInput.setValueState(sap.ui.core.ValueState.Error);
								oInput.setValueStateText(sErrorMessage);
							}else{
								oInput.setValueState(sap.ui.core.ValueState.None);
								oInput.setValueStateText("");
							}
						},
						validatePackageAppropiation: function(packagePrice, rewards) {
							var hasError = false;
							var oMessageManager = Utils.getMessageManager();
							var aMessages = [];
							var i18n = Utils.getI18NModel().getResourceBundle();
							
							Utils.removeMessagesByPath("/Rewards");
							
							var sum = rewards.reduce(function(result, reward, index) {
								var discoutPercentage = parseFloat(reward.PercentageValue);
								var discountValue = parseFloat(reward.PackageValue);
								
								reward.SubDiscountValueError = "None";
								reward.DiscountValueError = "None";
								
								if(discoutPercentage > 100 || discoutPercentage < 0) {
									hasError = true;
									aMessages.push({
										message : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationPercentage.Title"),
										description : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationPercentage.Description"),
										type : "Error",
										target : "/Rewards/" + index + "/PercentageValue"
									});									
								}
								if(discountValue < 0 || discountValue > packagePrice) {
									hasError = true;
									aMessages.push({
										message : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationValue.Title"),
										description : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationValue.Description"),
										type : "Error",
										target : "/Rewards/" + index + "/PackageValue"
									});
								}
								if(reward.PercentageValue && reward.PackageValue) {
									reward.SubDiscountValueError = "Error";
									reward.DiscountValueError = "Error";
									hasError = true;
									aMessages.push({
										message : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationPackage.Title"),
										description : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationPackage.Description"),
										type : "Error",
										target : "/Rewards/ApportionmentPercentageAndValue"
									});
								}
								result.percentage += discountValue ?  parseFloat(reward.Selection.SubDiscountValue) : (discoutPercentage || 0);
								result.value += discoutPercentage ?  parseFloat(reward.Selection.DiscountValue) : (discountValue || 0);
								return result;
							}, {value: 0, percentage: 0});
							
							if(sum.percentage > 100 && !hasError) {
								hasError = true;
								rewards.forEach(function(reward){
									reward.SubDiscountValueError = "Error";
								});
								aMessages.push({
									message : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationPercentageTotal.Title"),
									description : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationPercentageTotal.Description"),
									type : "Error",
									target : "/Rewards/AppropriationPercentageTotal"
								});
							}
							if(sum.value > packagePrice && !hasError) {
								hasError = true;
								rewards.forEach(function(reward){
									reward.DiscountValueError = "Error";
								});
								aMessages.push({
									message : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationValueTotal.Title"),
									description : i18n.getText("CreateOffer.Terms.FreestyleOffer.Invalid.AppropriationValueTotal.Description"),
									type : "Error",
									target : "/Rewards/AppropriationValueTotal"
								});
							}
							
							Utils.setErrorMessages(oMessageManager, aMessages,this.data);
							refreshModel(this.data);
							return hasError;
						},
						
						updatePackage: function(discountValGetter) {
							if(!this.generalModel.getProperty("/PackageOffer")) {
								return;
							}							
							var stringPackagePrice = this.getView().getModel("TermsContentModel").getProperty("/PackageValue");
							if(!stringPackagePrice){
								stringPackagePrice = "0";
								this.getView().getModel("TermsContentModel").setProperty("/PackageValue", stringPackagePrice);
							}
							
							var packagePrice = parseFloat(stringPackagePrice);
							var rewards = this.data.getProperty("/Rewards");
							
							if(!this.validatePackageAppropiation(packagePrice, rewards)) {								
								var packagePrice = parseFloat(this.getView().getModel("TermsContentModel").getProperty("/PackageValue"));
								var values = extractValues(rewards, packagePrice, discountValGetter);
								var percentageDistribution = distributePercentage(values, packagePrice);
								var valueDistribution = calculateValueDistribution(packagePrice, percentageDistribution);
								renderValues(this.data, valueDistribution, this.productDetails);
							}
						},
						updatePackageUserProjection: (function(){
							
							function setUserProjectionToZero(term){
								term.Selection.UserProjection = "0";
							}
							
							function updateUserProjection(floatPackageUP){
								return function(term){
									term.Selection.UserProjection = ((term.Selection.Quantity || 1) * floatPackageUP) + "";	
								};
							}
							
							function canUpdateUserProjection(packageUserProjection){
								var floatPackageUP = parseFloat(packageUserProjection);
								return !(packageUserProjection === null || packageUserProjection === undefined || floatPackageUP <= 0);
							}
							
							return function() {
								if(!this.generalModel.getProperty("/PackageOffer")) {
									return;
								}
								var packageUP = this.getView().getModel("TermsContentModel").getProperty("/UserProjectionValue");
								var terms = this.data.getProperty("/Terms");
								
								if(canUpdateUserProjection(packageUP)){
									terms.forEach(updateUserProjection(parseFloat(packageUP)));
								}else{
									terms.forEach(setUserProjectionToZero);
									this.getView().getModel("TermsContentModel").setProperty("/UserProjectionValue", "0");
								}
								
								refreshModel(this.data);
							};
						}()),
						
						handleFilter: function(oEvent) {
							var oSmartProductDetailsTable = this.getView().byId("smartProductDetailsTable");
							oSmartProductDetailsTable.filterColumn(oEvent);
						},
						
						updatePackageAppropiation: function() {
							this.updatePackage(rewardPackageValue);
						},
						validateProductDetailsDiscountValue : function(e){
							this.genericHandler(e, "minDiscountProductDetails", "/DiscountValue");	
						},
						validateProductDetailsSubDiscountValue: function(e){
							this.genericHandler(e, "minDiscountProductDetails", "/SubDiscountValue");
						},
						termValuesUpdated : function(e){
							var term = objectFromEvent(e);
							jQuery.extend(term.Selection, e.getParameter("values"));
						}		
					};

					["DiscountValue", "SubDiscountValue"].forEach(function(property){
						FreestylePrototype["update" + property] = function(event){
							var value = this.updateProductDetails(event, property);
							var reward = objectFromEvent(event);
							if(reward.ForTerm){
								reward.ForTerm[property] = value; 
							}
							var oMessageManager = Utils.getMessageManager();
							var aMessages = oMessageManager.getMessageModel().getData();
							var cleanMess = aMessages.filter(function(message){
								return message.target.indexOf("/ProductDetailsVisible") === -1 || message.target.indexOf(property) === -1; 
							});
							oMessageManager.removeAllMessages();
							oMessageManager.addMessages(cleanMess);
						};
					});
					
					[ "PromoCostPrice", "PromoCostPriceCurrency", "Quantity"].forEach(function(property) {
						FreestylePrototype["update" + property] = function(event) {
							this.updateProductDetails(event, property);
						};
					});
					
					return TermsBaseController.extend("retail.pmr.promotionaloffers.plugins.terms.styles.Freestyle", FreestylePrototype);
				});