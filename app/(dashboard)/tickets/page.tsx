'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { ticketsData } from '@/lib/mock-data'
import { Edit, Trash2 } from 'lucide-react'

const ticketColumns: Column[] = [
  {
    id: 'select',
    label: 'Select',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: 'checkbox',
    accessor: 'select'
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: 'action',
    render: () => (
      <div className="flex gap-1">
        <button className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors">
          <Edit className="h-4 w-4" />
        </button>
        <button className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )
  },
  {
    id: 'active',
    label: 'Active',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: 'toggle',
    accessor: 'active'
  },
  {
    id: 'distributorName',
    label: 'Distributor Name',
    width: 180,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    )
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 150,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  },
  {
    id: 'issue',
    label: 'Issue',
    width: 200,
    minWidth: 150,
    maxWidth: 350,
    sortable: true,
    type: 'text'
  },
  {
    id: 'revenueSchedule',
    label: 'Revenue Schedule',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'opportunityName',
    label: 'Opportunity Name',
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text'
  }
]

export default function TicketsPage() {
  const [tickets, setTickets] = useState(ticketsData)
  const [filteredTickets, setFilteredTickets] = useState(ticketsData)
  const [loading, setLoading] = useState(false)
  const [selectedTickets, setSelectedTickets] = useState<number[]>([])

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredTickets(tickets)
      return
    }

    const filtered = tickets.filter(ticket =>
      Object.values(ticket).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredTickets(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredTickets].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredTickets(sorted)
  }

  const handleRowClick = (ticket: any) => {
    console.log('Ticket clicked:', ticket)
    // Navigate to ticket detail page or open modal
  }

  const handleCreateTicket = () => {
    console.log('Create new ticket')
    // Open create ticket modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredTickets(tickets.filter(ticket => ticket.active))
    } else {
      setFilteredTickets(tickets)
    }
  }

  const handleSelectTicket = (ticketId: number, selected: boolean) => {
    if (selected) {
      setSelectedTickets(prev => [...prev, ticketId])
    } else {
      setSelectedTickets(prev => prev.filter(id => id !== ticketId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTickets(filteredTickets.map(ticket => ticket.id))
    } else {
      setSelectedTickets([])
    }
  }

  // Update tickets data to include selection state
  const ticketsWithSelection = filteredTickets.map(ticket => ({
    ...ticket,
    select: selectedTickets.includes(ticket.id)
  }))

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateTicket}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={ticketColumns}
          data={ticketsWithSelection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No tickets found"
        />
      </div>
    </div>
  )
}