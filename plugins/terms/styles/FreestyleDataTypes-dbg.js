/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function(){

	function TermType (id, description, dim, type){
		this.Id = id;
		this.Description = description;
		this.DimensionType = dim || null;
		this.Type = type || null;
		this.TermType = "1";
	}
	
	function RewardType (id, description, dim, type){
		this.Id = id;
		this.Description = description;
		this.DimensionType = dim || null;
		this.Type = type || null;
		this.TermType = "2";
	}
	
	function ConditionType(id, cls, type, description) {
		this.Id = id;
		this.Class = cls;
		this.Type = type;
		this.Description = description;
	}
	
	function IncentiveType(id, cls, type, description) {
		this.Id = id;
		this.Class = cls;
		this.Type = type;
		this.Description = description;
	}
	
	function Term (id, conditions, type){
		this.Identifier = id;
		this.Conditions = conditions || [];
		this.Type = type;
		this.OperatorLabel = "";
		this.TermType = "1";
		
		this.Selection = {
			ProductId: null,
			DimensionType: null,
			UnitOfMeasure: null,
			HierarchyId: null,
			HierarchyNodeId: null,
			Quantity: null,
			MinAmount: null,
			UserProjection: null,
			PromoCostPrice: null,
			PromoCostPriceCurrency: null

		};
	}
	
	function Reward (id, incentives, applicabilities, type){
		this.Identifier = id;
		this.Incentives = incentives || [];
		this.Applicabilities = applicabilities || [];
		this.Type = type;
		
		this.Applicability = "";
		
		this.ForTerm = null;
		this.InsteadOfLinkedReward = null;
		this.LinkedReward = null;
		
		this.TermType = "2";
		
		this.Selection = {
			DiscountAssignment : null,
			DiscountType : null,
			DiscountValue : null,
			SubDiscountValue : null,
			Variety : null,
			ProductId: null,
			DimensionType: null,
			UnitOfMeasure: null,
			HierarchyId: null,
			HierarchyNodeId: null,
			Quantity: null,
			UserProjection: null,
			PromoCostPrice : null,
			PromoCostPriceCurrency : null
		};
	}
	
	function Condition (id, cls, classDescription, description, type, productRelevant, quantityRelevant, categoryCode) {
		this.Id = id;
		this.Class = cls;
		this.ClassDescription = classDescription;
		this.Description = description;
		this.Type = type;
		this.SubConditionsProps = {
			isProductRelevant: productRelevant || "",
			isQuantityRelevant: quantityRelevant || "",
			CategoryCode: categoryCode || ""
		};
		this.SubConditions = [];
	}

	function Incentive (id, cls, classDescription, description, type, productRelevant, quantityRelevant, categoryCode) {
		this.Id = id;
		this.Class = cls;
		this.ClassDescription = classDescription;
		this.Description = description;
		this.Type = type;
		this.SubIncentivesProps = {
			isProductRelevant: productRelevant || "",
			isQuantityRelevant: quantityRelevant || "",
			CategoryCode: categoryCode || ""
		};
		this.SubIncentives = [];
	}

	function RewardApplicabilityForTerm(id, name, term){
		this.Id = id;
		this.Name = name;
		this.Type = "ForTerm";
		this.Term = term;
	}
	
	function RewardApplicabilityInsteadOf(id, name, reward){
		this.Id = id;
		this.Name = name;
		this.Type = "InsteadOf";
		this.Reward = reward;
	}
	
	function RewardApplicabilityWholeOffer(id, name){
		this.Id = id;
		this.Name = name;
		this.Type = "WholeOffer";
	}
	
	return {
		TermType: TermType,
		RewardType : RewardType,
		ConditionType: ConditionType,
		IncentiveType : IncentiveType,
		Term : Term,
		Reward : Reward,
		Condition : Condition,
		Incentive : Incentive,
		RewardApplicabilityForTerm : RewardApplicabilityForTerm,
		RewardApplicabilityWholeOffer : RewardApplicabilityWholeOffer,
		RewardApplicabilityInsteadOf : RewardApplicabilityInsteadOf
	};
	
}, true);