-- Harga jual (selling price) untuk artikel, terpisah dari harga_satuan
-- yang tetap murni jadi ongkos jasa jahit / dasar hitung gaji operator.
ALTER TABLE "artikels" ADD COLUMN "harga_jual" DECIMAL DEFAULT 0;
