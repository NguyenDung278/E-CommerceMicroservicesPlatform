package model

type ProductSearchSuggestion struct {
	Value      string `json:"value"`
	Kind       string `json:"kind"`
	MatchCount int    `json:"match_count"`
}

type ProductSearchFacetValue struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type ProductSearchFacet struct {
	Key    string                    `json:"key"`
	Label  string                    `json:"label"`
	Values []ProductSearchFacetValue `json:"values"`
}

type ProductSearchSortOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

type ProductSearchAssist struct {
	Query           string                    `json:"query"`
	ResolvedQuery   string                    `json:"resolved_query"`
	AppliedSynonyms []string                  `json:"applied_synonyms"`
	ResultCount     int                       `json:"result_count"`
	Suggestions     []ProductSearchSuggestion `json:"suggestions"`
	Facets          []ProductSearchFacet      `json:"facets"`
	SortOptions     []ProductSearchSortOption `json:"sort_options"`
}
