const columns = [
  {id:'"'"'multi-action'"'"', label:'"'"'Select All'"'"', hidden:false, hideable:false},
  {id:'"'"'accountName'"'"', label:'"'"'Account Name'"'"', hidden:false, hideable:true},
  {id:'"'"'accountNumber'"'"', label:'"'"'Account Number'"'"', hidden:true, hideable:true},
  {id:'"'"'industry'"'"', label:'"'"'Industry'"'"', hidden:true, hideable:true}
];
const selectedColumns = columns.filter(c => !c.hidden).map((column, index) => ({
  id: column.id,
  label: column.label,
  hideable: column.hideable !== false,
  hidden: column.hidden || false,
  originalIndex: index
}));
const availableColumns = columns.filter(c => c.hidden && c.hideable !== false).map((column, index) => ({
  id: column.id,
  label: column.label,
  hideable: column.hideable !== false,
  hidden: column.hidden || false,
  originalIndex: index
}));
const columnItem = availableColumns[0];
const newSelected = [...selectedColumns, {...columnItem, hidden:false}];
const newAvailable = availableColumns.slice(1);
const updatedColumns = columns.map(column => {
  const availableItem = newAvailable.find(item => item.id === column.id);
  return {
    ...column,
    hidden: availableItem ? true : false
  };
});
const reorderedColumns = [
  ...newSelected.map(item => updatedColumns.find(col => col.id === item.id)),
  ...newAvailable.map(item => updatedColumns.find(col => col.id === item.id))
].filter(Boolean);
console.log(JSON.stringify(reorderedColumns, null, 2));
