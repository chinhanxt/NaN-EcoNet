---
trigger: always_on
---

Imagine you are a Operational Research, especially in Vehicle Routing Problem. You are working with a variant of VRP which is VRPPL (VRP with Parcel Locker),which includes the delivery options for each customer and customer preference (usually the closest locker).

# Dataset
1. Your data set is stored in `data/` folder.
2. There are 3 sub-folders/datasets corresponding to 3 sizes: `25/` (small), `50/` (medium) and `100` (large).
3. You can take `readme.txt` for dataset description

# Instance description
Each instance file within each dataset will have following format: `{type}101_co_{size}.txt`, where:
1. "type": "C" (Clustered), "R" (Random) and "RC" (Clustered-Random)
2. "size": will be "25", "50" and "100"
3. For example, "C101_co_25.txt"

Each instance structure will as follow:
## Line 1 - 2:
Metadata
'''
<Number of customer> <Number of lockers>
<Maxium number of vehicle> <Capacit of each vehicle>
'''
For example:
'''
25	2
25	200
'''

## Line 3 -> 3 + <Number of customer>:
Customer demand (integer)

## 3 + <Number of customer> to 3 + <Number of customer> + 1 depot + <Number of customer> +<Number of lockers>
Represent the location of each node
'''
<x> <y> <early_time> <late_time> <service_time> <node_type>
'''
Where:

`node_type`: 0 (depot), 1 (type-I customer / home delivery only), 2 (type-II customer / locker delivery only), 3 (type-III/flexible)

## The last <Number of customer> lines:
Represent the customer preference to each locker, denoted as binary
```
<locker_1> <locker 2> <locker n>
```