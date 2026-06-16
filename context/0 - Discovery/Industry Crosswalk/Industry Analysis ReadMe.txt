/*** Dynamics 365 Global Regulatory / Compliance Matrix **/

Purpose
Starter csv files  for mapping Dynamics 365 Sales Account industry codes to regulatory/compliance bodies, legislation sources and official online resources by territory/region.

Important limitation
This is a structured matrix and authoritative source registry, not legal advice and not a complete country-by-country legal opinion. National and subnational laws change frequently; validate with counsel and official gazettes/regulators before use.

How to use
1) Use Industry x Domain Matrix to identify compliance domains per Dynamics industry code.
2) Use Territory x Source Matrix and Source Registry to research agency names, laws and regulator websites for each operating territory. 
3) Populate Import Template with specific country/regulator/law records for Dataverse import.

Recommended Dataverse tables
Regulatory Jurisdiction; Regulatory Body; Legislation; Compliance Domain; Industry Regulation Mapping; Compliance Requirement; Regulatory Update; Account Regulatory Profile.

Primary Name Columns
IndustryCode + TerritoryCode + ComplianceDomain + RegulatorName + LegislationName.
