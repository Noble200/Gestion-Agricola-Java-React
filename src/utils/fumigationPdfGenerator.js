import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

class FumigationPDFGenerator {
  constructor() {
    this.doc = null;
    this.pageWidth = 210;
    this.pageHeight = 297;
    this.margin = 15;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  async generateFumigationOrder(fumigation, products = [], mapImage = null) {
    try {
      this.doc = new jsPDF();
      this.currentY = this.margin;
      
      this.addHeader(fumigation);
      
      this.addEstablishmentInfo(fumigation);
      
      this.addProductsTable(fumigation, products);
      
      this.addTimeFields();
      
      this.addObservations(fumigation);
      
      if (mapImage) {
        await this.addMapAtBottom(mapImage);
      }
      
      return this.doc;
    } catch (error) {
      console.error('Error al generar PDF:', error);
      throw new Error('Error al generar el PDF de fumigación: ' + error.message);
    }
  }

  addHeader(fumigation) {
    autoTable(this.doc, {
      startY: this.currentY,
      body: [['ORDEN DE APLICACIÓN', `N° ${fumigation.orderNumber || '23'}`]],
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 14,
        halign: 'center',
        lineWidth: 2,
        lineColor: [0, 0, 0],
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: this.contentWidth / 2 },
        1: { cellWidth: this.contentWidth / 2 }
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 2,
      margin: { left: this.margin, right: this.margin },
      theme: 'grid'
    });
    
    this.currentY = this.doc.lastAutoTable.finalY;
  }

  addEstablishmentInfo(fumigation) {
    const data = [
      ['FECHA:', this.formatDate(fumigation.applicationDate)],
      ['ESTABLECIMIENTO:', fumigation.establishment || 'El Charabón'],
      ['APLICADOR:', fumigation.applicator || 'Caiman']
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      body: data,
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 11,
        cellPadding: 3,
        lineWidth: 2,
        lineColor: [0, 0, 0]
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 50 },
        1: { halign: 'center', cellWidth: this.contentWidth - 50 }
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 2,
      margin: { left: this.margin, right: this.margin },
      theme: 'grid'
    });
    
    this.currentY = this.doc.lastAutoTable.finalY;
  }

  addProductsTable(fumigation, products) {
    const headers = [['CULTIVO', 'LOTE', 'SUPERFICIE', 'PRODUCTO', 'DOSIS / HA', 'TOTAL\nPRODUCTO']];
    
    const productData = this.prepareProductData(fumigation, products);
    
    autoTable(this.doc, {
      startY: this.currentY,
      head: headers,
      body: productData,
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        lineWidth: 2,
        lineColor: [0, 0, 0],
        cellPadding: 2
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
    fontSize: 9,
    cellPadding: 2,
        lineWidth: 2,
        lineColor: [0, 0, 0],
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center' }, // CULTIVO
        1: { 
          halign: 'center',
          fillColor: [144, 238, 144]
        }, // LOTE
        2: { halign: 'center' }, // SUPERFICIE
        3: { halign: 'left' }, // PRODUCTO
        4: { halign: 'center' }, // DOSIS
        5: { halign: 'center' }  // TOTAL
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 2,
      margin: { left: this.margin, right: this.margin },
      theme: 'grid',
      didParseCell: function(data) {
        // Aplicar verde solo a la celda del lote con contenido
        if (data.column.index === 1 && data.row.index >= 0 && data.cell.text[0] !== '') {
          data.cell.styles.fillColor = [144, 238, 144];
        }
      }
    });
    
    this.currentY = this.doc.lastAutoTable.finalY;
  }

  prepareProductData(fumigation, products) {
    const rows = [];
    
    if (!fumigation.selectedProducts || fumigation.selectedProducts.length === 0) {
      return [
        [
          'Soja',
          'Lotes 1A y 1B',
          '75',
          'Humectante',
          '40 cc/ha',
          '3,00 Lts'
        ],
        [
          '',
          '',
          '',
          'Bifentrin',
          '250 cc/ha',
          '18,75 Lts'
        ],
        [
          '',
          '',
          '',
          'Lambdacialotrina 25%',
          '40 cc/ha',
          '3,00 Lts'
        ]
      ];
    }

    fumigation.selectedProducts.forEach((selectedProduct, index) => {
      const productInfo = products.find(p => p.id === selectedProduct.productId);
      const productName = productInfo ? productInfo.name : 'Producto desconocido';
      
      if (index === 0) {
        rows.push([
          fumigation.crop || 'Soja',
          this.getLotsText(fumigation),
          fumigation.totalSurface || '75',
          productName,
          this.formatDose(selectedProduct),
          this.formatTotal(selectedProduct)
        ]);
      } else {
        rows.push([
          '',
          '',
          '',
          productName,
          this.formatDose(selectedProduct),
          this.formatTotal(selectedProduct)
        ]);
      }
    });

    return rows;
  }

  addTimeFields() {
    const timeData = [
      ['FECHA Y HORA DE INICIO', ''],
      ['FECHA Y HORA DE FIN', '']
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      body: timeData,
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 11,
        cellPadding: 6,
        lineWidth: 2,
        lineColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: this.contentWidth / 2 },
        1: { cellWidth: this.contentWidth / 2 }
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 2,
      margin: { left: this.margin, right: this.margin },
      theme: 'grid'
    });
    
    this.currentY = this.doc.lastAutoTable.finalY;
  }

  addObservations(fumigation) {
    autoTable(this.doc, {
      startY: this.currentY,
      body: [['OBSERVACIONES:']],
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 11,
        cellPadding: 3,
        lineWidth: 2,
        lineColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 2,
      margin: { left: this.margin, right: this.margin },
      theme: 'grid'
    });
    
    this.currentY = this.doc.lastAutoTable.finalY;

    const observations = [
      {
        text: `Mantener caudal mayor a ${fumigation.flowRate || 80} lts de caldo por hectárea.`,
        color: [255, 255, 255]
      },
      {
        text: 'No aplicar con alta insolación ni rocío',
        color: [255, 255, 255]
      },
      {
        text: 'La aplicación en color verde es para hacer en todo el lote',
        color: [144, 238, 144]
      },
      {
        text: 'La aplicación en celeste es para hacer en cabeceras, la superficie es aproximada',
        color: [173, 216, 230]
      }
    ];

    if (fumigation.observations) {
      observations.push({
        text: fumigation.observations,
        color: [255, 255, 255]
      });
    }
    
    observations.forEach((obs) => {
      autoTable(this.doc, {
        startY: this.currentY,
        body: [[obs.text]],
        bodyStyles: {
          fillColor: obs.color,
          textColor: [0, 0, 0],
          fontSize: 9,
          cellPadding: 3,
          lineWidth: 2,
          lineColor: [0, 0, 0],
          halign: 'center'
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 2,
        margin: { left: this.margin, right: this.margin },
        theme: 'grid'
      });
      
      this.currentY = this.doc.lastAutoTable.finalY;
    });
  }

  async addMapAtBottom(imageFile) {
    try {
      const imageDataUrl = await this.fileToDataURL(imageFile);
      
      const availableSpace = this.pageHeight - this.margin - this.currentY;
      
      let imageHeight = Math.min(80, availableSpace - 10);
      let imageWidth = imageHeight * 1.4;
      
      if (imageWidth > this.contentWidth) {
        imageWidth = this.contentWidth;
        imageHeight = imageWidth / 1.4;
      }
      
      if (availableSpace >= 35) {
        this.currentY += 5;
        
        const imageX = (this.pageWidth - imageWidth) / 2;
        
        this.doc.addImage(
          imageDataUrl,
          'JPEG',
          imageX,
          this.currentY,
          imageWidth,
          imageHeight,
          undefined,
          'FAST'
        );
        
        this.currentY += imageHeight;
      }
      
    } catch (error) {
      console.error('Error al agregar imagen:', error);
    }
  }

  fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  getLotsText(fumigation) {
    if (!fumigation.lots || fumigation.lots.length === 0) {
      return 'Lotes 1A y 1B';
    }
    return fumigation.lots.map(lot => lot.name).join(' y ');
  }

  formatDose(product) {
    return `${product.dosePerHa} ${product.doseUnit}`;
  }

  formatTotal(product) {
    const total = product.totalQuantity || 0;
    const unit = product.unit || 'L';
    
    if (unit === 'ml' || unit === 'cc') {
      if (total >= 1000) {
        return `${(total / 1000).toFixed(2).replace('.', ',')} Lts`;
      }
      return `${total.toFixed(0)} ${unit}`;
    } else if (unit === 'L') {
      return `${total.toFixed(2).replace('.', ',')} Lts`;
    } else if (unit === 'kg') {
      return `${total.toFixed(2).replace('.', ',')} Kg`;
    } else if (unit === 'g') {
      if (total >= 1000) {
        return `${(total / 1000).toFixed(2).replace('.', ',')} Kg`;
      }
      return `${total.toFixed(0)} g`;
    }
    
    return `${total.toFixed(2).replace('.', ',')} ${unit}`;
  }

  formatDate(date) {
    if (!date) return '13 de marzo 2025';
    
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  downloadPDF(fumigation, filename = null) {
    if (!this.doc) {
      throw new Error('No hay documento PDF generado');
    }
    
    const defaultFilename = `Orden_Fumigacion_${fumigation.orderNumber || 'SIN_NUMERO'}_${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(filename || defaultFilename);
  }

  getPDFBlob() {
    if (!this.doc) {
      throw new Error('No hay documento PDF generado');
    }
    return this.doc.output('blob');
  }

  getPDFDataURL() {
    if (!this.doc) {
      throw new Error('No hay documento PDF generado');
    }
    return this.doc.output('dataurlstring');
  }
}

export const generateFumigationPDF = async (fumigation, products = [], mapImage = null) => {
  const generator = new FumigationPDFGenerator();
  await generator.generateFumigationOrder(fumigation, products, mapImage);
  return generator;
};

export const downloadFumigationPDF = async (fumigation, products = [], mapImage = null, filename = null) => {
  const generator = await generateFumigationPDF(fumigation, products, mapImage);
  generator.downloadPDF(fumigation, filename);
};

export default FumigationPDFGenerator;
