-- Νέος τύπος εγγράφου: ασφάλεια μηχανής (ξεχωριστή από την ασφάλεια αυτοκινήτου)
alter type public.document_type add value if not exists 'motorcycle_insurance' after 'car_insurance';
